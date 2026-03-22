import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { NoteService } from "@/services/notes/noteService";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
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

export default function useNotes() {
	const capabilities = useStorageStore((s) => s.capabilities);
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
	const latestFiltersRef = useRef(filters);

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
			const nextFilters = overrides?.filters ?? latestFiltersRef.current;
			if (loadingRef.current) {
				if (!append) {
					pendingRefreshRef.current = true;
					latestQueryRef.current = searchQuery;
					latestFiltersRef.current = nextFilters;
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
				const normalizedQuery = capabilities.canSearch ? searchQuery : "";
				const results = capabilities.canSearch
					? await NotesIndexService.listNotes(
							normalizedQuery,
							PAGE_SIZE,
							offset,
							nextFilters,
						)
					: await NoteService.listNotesFallback(
							normalizedQuery,
							PAGE_SIZE,
							offset,
							nextFilters,
						);
				nextOffsetRef.current = results.cursor;
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
				if (pendingRefreshRef.current) {
					pendingRefreshRef.current = false;
					void fetchNotes(false);
				}
			}
		},
		[capabilities.canSearch, initializationStatus],
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
		latestFiltersRef.current = filters;
	}, [debouncedQuery, filters]);

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
