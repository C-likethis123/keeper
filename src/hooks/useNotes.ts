import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { NoteSection } from "@/services/notes/indexDb/types";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import {
	notesIndexDbGetGraphNeighborhood,
	notesIndexDbGetMocScores,
	notesIndexDbGetRecentlyEditedNotes,
} from "@/services/notes/notesIndexDb";
import type {
	Note,
	NoteListFilters,
	NoteStatus,
	NoteType,
} from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function toNote(item: NoteIndexItem): Note {
	return {
		id: item.noteId,
		title: item.title,
		content: item.summary,
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
		noteType: item.noteType ?? "note",
		status: item.status,
	};
}

function computeSections(
	allNotes: Note[],
	pinnedNotes: Note[],
	recentlyEditedNoteIds: Set<string>,
	mocNeighborhoods: Map<string, Set<string>>,
): NoteSection[] {
	const sections: NoteSection[] = [];

	// 1. Pinned section
	if (pinnedNotes.length > 0) {
		sections.push({
			id: "pinned",
			title: "Pinned",
			notes: pinnedNotes,
		});
	}

	// 2. Recently Edited section
	const recentlyEditedNotes = allNotes.filter((n) =>
		recentlyEditedNoteIds.has(n.id),
	);
	if (recentlyEditedNotes.length > 0) {
		sections.push({
			id: "recently-edited",
			title: "Recently Edited",
			notes: recentlyEditedNotes,
		});
	}

	// 3. MOC sections
	for (const [mocNoteId, neighborhoodIds] of mocNeighborhoods) {
		const mocNote = allNotes.find((n) => n.id === mocNoteId);
		if (!mocNote) continue;

		const neighborhoodNotes = allNotes.filter((n) => neighborhoodIds.has(n.id));
		if (neighborhoodNotes.length > 0) {
			sections.push({
				id: `moc-${mocNoteId}`,
				title: mocNote.title,
				notes: neighborhoodNotes,
			});
		}
	}

	// 4. All Notes (everything not already shown)
	const shownNoteIds = new Set<string>();
	for (const section of sections) {
		for (const note of section.notes) {
			shownNoteIds.add(note.id);
		}
	}
	const allNotesSection = allNotes.filter((n) => !shownNoteIds.has(n.id));
	if (allNotesSection.length > 0) {
		sections.push({
			id: "all-notes",
			title: "All Notes",
			notes: allNotesSection,
		});
	}

	return sections;
}

export default function useNotes() {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 300);
	const [noteTypeFilter, setNoteTypeFilter] = useState<NoteType[]>([]);
	const [statusFilter, setStatusFilter] = useState<NoteStatus | undefined>(
		undefined,
	);
	const [notes, setNotes] = useState<Note[]>([]);
	const [sections, setSections] = useState<NoteSection[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadingRef = useRef(false);
	const pendingRefreshRef = useRef(false);
	const nextOffsetRef = useRef<number | undefined>(undefined);

	const filters = useMemo<NoteListFilters>(
		() => ({
			noteTypes: noteTypeFilter.length > 0 ? noteTypeFilter : undefined,
			status: statusFilter,
		}),
		[noteTypeFilter, statusFilter],
	);
	const latestQueryRef = useRef(debouncedQuery);

	const fetchNotes = useCallback(
		async (
			append: boolean,
			overrides?: {
				searchQuery?: string;
				filters?: NoteListFilters;
			},
		) => {
			if (initializationStatus !== "ready") return;
			const searchQuery = overrides?.searchQuery ?? latestQueryRef.current;
			if (loadingRef.current) {
				if (!append) {
					pendingRefreshRef.current = true;
					latestQueryRef.current = searchQuery;
				}
				return;
			}
			loadingRef.current = true;
			setIsLoading(true);
			try {
				const offset = append ? (nextOffsetRef.current ?? 0) : 0;
				if (!append) {
					nextOffsetRef.current = undefined;
					setError(null);
				}
				const results = await NotesIndexService.listNotes(
					searchQuery,
					PAGE_SIZE,
					offset,
					filters,
				);
				nextOffsetRef.current = results.cursor;
				const newNotes = results.items.map(toNote);
				if (append) {
					setNotes((prev) => [...prev, ...newNotes]);
				} else {
					setNotes(newNotes);
				}
				setHasMore(!!results.cursor);

				// Compute sections (only on initial load, not on append)
				if (!append) {
					const allNotes = newNotes;
					const pinnedNotes = allNotes.filter((n) => n.isPinned);

					// Fetch recently edited note IDs
					const recentlyEditedRows = await notesIndexDbGetRecentlyEditedNotes(
						10,
						7,
					);
					const recentlyEditedNoteIds = new Set(
						recentlyEditedRows.map((r) => r.id),
					);

					// Fetch MOC scores and neighborhoods
					const mocScores = await notesIndexDbGetMocScores(3);
					const mocNeighborhoods = new Map<string, Set<string>>();
					for (const score of mocScores.slice(0, 5)) {
						// Cap at 5 MOCs to avoid overwhelming UI
						const neighborhood = await notesIndexDbGetGraphNeighborhood(
							score.noteId,
							2,
						);
						const neighborhoodIds = new Set(
							neighborhood.map((n) => n.noteId).slice(0, 8),
						); // Cap at 8 notes per MOC
						if (neighborhoodIds.size > 0) {
							mocNeighborhoods.set(score.noteId, neighborhoodIds);
						}
					}

					const computedSections = computeSections(
						allNotes,
						pinnedNotes,
						recentlyEditedNoteIds,
						mocNeighborhoods,
					);
					setSections(computedSections);
				}
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message);
				}
			} finally {
				loadingRef.current = false;
				setIsLoading(false);
				if (pendingRefreshRef.current) {
					pendingRefreshRef.current = false;
					void fetchNotes(false);
				}
			}
		},
		[initializationStatus, filters],
	);

	const loadMoreNotes = useCallback(async () => {
		if (!hasMore || isLoading) return;
		await fetchNotes(true);
	}, [hasMore, isLoading, fetchNotes]);

	const handleRefresh = useCallback(async () => {
		await fetchNotes(false);
	}, [fetchNotes]);

	useEffect(() => {
		latestQueryRef.current = debouncedQuery;
	}, [debouncedQuery]);

	useEffect(() => {
		if (initializationStatus === "pending") {
			setIsLoading(true);
			return;
		}

		if (initializationStatus === "failed") {
			setIsLoading(false);
			setNotes([]);
			setHasMore(false);
			setError(initializationError ?? "Storage is unavailable");
			return;
		}

		void contentVersion;
		void fetchNotes(false, {
			searchQuery: debouncedQuery,
			filters,
		});
	}, [
		fetchNotes,
		debouncedQuery,
		filters,
		initializationError,
		contentVersion,
		initializationStatus,
	]);

	return {
		notes,
		sections,
		hasMore,
		isLoading,
		loadMoreNotes,
		setQuery,
		noteTypeFilter,
		setNoteTypeFilter,
		statusFilter,
		setStatusFilter,
		query,
		error,
		handleRefresh,
	};
}
