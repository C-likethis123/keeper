import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { NoteSection } from "@/services/notes/indexDb/types";
import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
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
import { useFilterStore } from "@/stores/filterStore";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import {
	startTransition,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

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

function buildNotesQueryKey(args: {
	query: string;
	filters: NoteListFilters;
	contentVersion: number;
	refreshVersion: number;
}) {
	return JSON.stringify({
		scope: "notes",
		query: args.query,
		filters: args.filters,
		contentVersion: args.contentVersion,
		refreshVersion: args.refreshVersion,
	});
}

async function loadNotesPage(args: {
	query: string;
	filters: NoteListFilters;
	offset: number;
}) {
	return NotesIndexService.listNotes(
		args.query,
		PAGE_SIZE,
		args.offset,
		args.filters,
	);
}

async function loadSectionMetadata() {
	const recentlyEditedRows = await notesIndexDbGetRecentlyEditedNotes(10, 7);
	const recentlyEditedNoteIds = new Set(recentlyEditedRows.map((row) => row.id));

	const mocScores = await notesIndexDbGetMocScores(3);
	const mocNeighborhoods = new Map<string, Set<string>>();

	for (const score of mocScores.slice(0, 5)) {
		const neighborhood = await notesIndexDbGetGraphNeighborhood(score.noteId, 2);
		const neighborhoodIds = new Set(
			neighborhood.map((entry) => entry.noteId).slice(0, 8),
		);
		if (neighborhoodIds.size > 0) {
			mocNeighborhoods.set(score.noteId, neighborhoodIds);
		}
	}

	return {
		recentlyEditedNoteIds,
		mocNeighborhoods,
	};
}

export default function useSuspenseNotes() {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 300);
	const noteTypeFilter = useFilterStore((s) => s.noteTypes);
	const statusFilter = useFilterStore((s) => s.status);
	const setNoteTypeFilter = useFilterStore((s) => s.setNoteTypes);
	const setStatusFilter = useFilterStore((s) => s.setStatus);
	const [refreshVersion, setRefreshVersion] = useState(0);
	const [paginationState, setPaginationState] = useState<{
		baseKey: string;
		notes: Note[];
		nextOffset?: number;
		isLoadingMore: boolean;
		error: string | null;
	}>({
		baseKey: "",
		notes: [],
		nextOffset: undefined,
		isLoadingMore: false,
		error: null,
	});
	const [sectionMetadata, setSectionMetadata] = useState<{
		recentlyEditedNoteIds: Set<string>;
		mocNeighborhoods: Map<string, Set<string>>;
	}>({
		recentlyEditedNoteIds: new Set(),
		mocNeighborhoods: new Map(),
	});
	const sectionRequestVersionRef = useRef(0);

	const filters = useMemo<NoteListFilters>(
		() => ({
			noteTypes: noteTypeFilter.length > 0 ? noteTypeFilter : undefined,
			status: statusFilter,
		}),
		[noteTypeFilter, statusFilter],
	);

	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	const baseKey = buildNotesQueryKey({
		query: debouncedQuery,
		filters,
		contentVersion,
		refreshVersion,
	});
	const baseResult = use(
		getCachedQueryPromise(baseKey, () =>
			loadNotesPage({
				query: debouncedQuery,
				filters,
				offset: 0,
			}),
		),
	);
	const baseNotes = useMemo(() => baseResult.items.map(toNote), [baseResult]);
	const activePagination =
		paginationState.baseKey === baseKey
			? paginationState
			: {
					baseKey,
					notes: [],
					nextOffset: baseResult.cursor,
					isLoadingMore: false,
					error: null,
				};

	useEffect(() => {
		setPaginationState({
			baseKey,
			notes: [],
			nextOffset: baseResult.cursor,
			isLoadingMore: false,
			error: null,
		});
	}, [baseKey, baseResult.cursor]);

	const loadMoreNotes = useCallback(async () => {
		if (activePagination.isLoadingMore || activePagination.nextOffset == null) {
			return;
		}

		setPaginationState((current) =>
			current.baseKey === baseKey
				? {
						...current,
						isLoadingMore: true,
						error: null,
					}
				: current,
		);

		try {
			const result = await loadNotesPage({
				query: debouncedQuery,
				filters,
				offset: activePagination.nextOffset,
			});
			setPaginationState((current) => {
				if (current.baseKey !== baseKey) {
					return current;
				}

				return {
					...current,
					notes: [...current.notes, ...result.items.map(toNote)],
					nextOffset: result.cursor,
					isLoadingMore: false,
				};
			});
		} catch (error) {
			setPaginationState((current) => {
				if (current.baseKey !== baseKey) {
					return current;
				}

				return {
					...current,
					isLoadingMore: false,
					error: error instanceof Error ? error.message : String(error),
				};
			});
		}
	}, [
		activePagination.isLoadingMore,
		activePagination.nextOffset,
		baseKey,
		debouncedQuery,
		filters,
	]);

	const handleRefresh = useCallback(async () => {
		startTransition(() => {
			setRefreshVersion((current) => current + 1);
		});
	}, []);

	const allNotes = useMemo(
		() => [...baseNotes, ...activePagination.notes],
		[baseNotes, activePagination.notes],
	);

	useEffect(() => {
		void contentVersion;
		void refreshVersion;

		const requestVersion = sectionRequestVersionRef.current + 1;
		sectionRequestVersionRef.current = requestVersion;

		let cancelled = false;

		void loadSectionMetadata()
			.then((metadata) => {
				if (cancelled) {
					return;
				}
				if (sectionRequestVersionRef.current !== requestVersion) {
					return;
				}
				setSectionMetadata(metadata);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				if (sectionRequestVersionRef.current !== requestVersion) {
					return;
				}
				setSectionMetadata({
					recentlyEditedNoteIds: new Set(),
					mocNeighborhoods: new Map(),
				});
			});

		return () => {
			cancelled = true;
		};
	}, [contentVersion, refreshVersion]);

	const sections = useMemo(() => {
		const pinnedNotes = allNotes.filter((n) => n.isPinned);

		return computeSections(
			allNotes,
			pinnedNotes,
			sectionMetadata.recentlyEditedNoteIds,
			sectionMetadata.mocNeighborhoods,
		);
	}, [allNotes, sectionMetadata]);

	return {
		notes: allNotes,
		sections,
		hasMore: activePagination.nextOffset != null,
		isLoading: activePagination.isLoadingMore,
		loadMoreNotes,
		setQuery,
		noteTypeFilter,
		setNoteTypeFilter,
		statusFilter,
		setStatusFilter,
		query,
		error: activePagination.error,
		handleRefresh,
	};
}
