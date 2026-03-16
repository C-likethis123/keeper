import { PAGE_SIZE } from "@/constants/pagination";
import { NoteService } from "@/services/notes/noteService";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import type { Note, NoteListFilters, NoteStatus, NoteType } from "@/services/notes/types";
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

export default function useNotes() {
	const capabilities = useStorageStore((s) => s.capabilities);
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const [query, setQuery] = useState("");
	const [noteTypeFilter, setNoteTypeFilter] = useState<NoteType | undefined>(
		undefined,
	);
	const [statusFilter, setStatusFilter] = useState<NoteStatus | undefined>(
		undefined,
	);
	const [notes, setNotes] = useState<Note[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadingRef = useRef(false);
	const nextOffsetRef = useRef<number | undefined>(undefined);
	const prevQueryRef = useRef(query);
	const prevNoteTypeFilterRef = useRef(noteTypeFilter);
	const prevStatusFilterRef = useRef(statusFilter);
	const prevContentVersionRef = useRef(contentVersion);

	const filters = useMemo<NoteListFilters>(
		() => ({
			noteType: noteTypeFilter,
			status: statusFilter,
		}),
		[noteTypeFilter, statusFilter],
	);

	const fetchNotes = useCallback(
		async (append: boolean) => {
			if (initializationStatus !== "ready") return;
			if (loadingRef.current) return;
			loadingRef.current = true;
			setIsLoading(true);
			try {
				const offset = append ? (nextOffsetRef.current ?? 0) : 0;
				const searchQuery = capabilities.canSearch ? query : "";
				const results = capabilities.canSearch
					? await NotesIndexService.listNotes(
							searchQuery,
							PAGE_SIZE,
							offset,
							filters,
						)
					: await NoteService.listNotesFallback(
							searchQuery,
							PAGE_SIZE,
							offset,
							filters,
						);
				nextOffsetRef.current = results.cursor?.offset;
				const newNotes = results.items.map(toNote);
				if (append) {
					setNotes((prev) => [...prev, ...newNotes]);
				} else {
					setNotes(newNotes);
				}
				setHasMore(!!results.cursor);
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message);
				}
			} finally {
				loadingRef.current = false;
				setIsLoading(false);
			}
		},
		[filters, query, capabilities.canSearch, initializationStatus],
	);

	const loadMoreNotes = useCallback(async () => {
		if (!hasMore || isLoading) return;
		await fetchNotes(true);
	}, [hasMore, isLoading, fetchNotes]);

	const handleRefresh = useCallback(async () => {
		setError(null);
		nextOffsetRef.current = undefined;
		await fetchNotes(false);
	}, [fetchNotes]);

	useEffect(() => {
		if (initializationStatus === "pending") {
			setIsLoading(true);
			return;
		}

		if (initializationStatus === "failed") {
			setIsLoading(false);
			setNotes([]);
			setHasMore(false);
			setError(capabilities.reason ?? "Storage is unavailable");
			return;
		}

		let cancelled = false;
		const isQueryChange = prevQueryRef.current !== query;
		const isTypeFilterChange = prevNoteTypeFilterRef.current !== noteTypeFilter;
		const isStatusFilterChange = prevStatusFilterRef.current !== statusFilter;
		const filtersChanged = isTypeFilterChange || isStatusFilterChange;
		const contentChanged = prevContentVersionRef.current !== contentVersion;
		if (isQueryChange) {
			if (!capabilities.canSearch) return;
			prevQueryRef.current = query;
		}
		if (isTypeFilterChange) {
			prevNoteTypeFilterRef.current = noteTypeFilter;
		}
		if (isStatusFilterChange) {
			prevStatusFilterRef.current = statusFilter;
		}
		if (contentChanged) {
			prevContentVersionRef.current = contentVersion;
		}
		const timeoutId = isQueryChange
			? setTimeout(() => {
					if (!cancelled) fetchNotes(false);
				}, 300)
			: undefined;
		if (!isQueryChange || filtersChanged || contentChanged) {
			fetchNotes(false);
		}
		return () => {
			cancelled = true;
			if (timeoutId != null) clearTimeout(timeoutId);
		};
	}, [
		fetchNotes,
		query,
		noteTypeFilter,
		statusFilter,
		capabilities.canSearch,
		capabilities.reason,
		contentVersion,
		initializationStatus,
	]);

	return {
		notes,
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
