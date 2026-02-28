import { PAGE_SIZE } from "@/constants/pagination";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { useCallback, useEffect, useRef, useState } from "react";

function toNote(item: NoteIndexItem): Note {
	return {
		id: item.noteId,
		title: item.title,
		content: item.summary,
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
	};
}

export default function useNotes() {
	const [query, setQuery] = useState("");
	const [notes, setNotes] = useState<Note[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const loadingRef = useRef(false);
	const nextOffsetRef = useRef<number | undefined>(undefined);
	const prevQueryRef = useRef(query);

	const fetchNotes = useCallback(
		async (append: boolean) => {
			if (loadingRef.current) return;
			loadingRef.current = true;
			setIsLoading(true);
			try {
				const offset = append ? (nextOffsetRef.current ?? 0) : 0;
				const results = await NotesIndexService.listNotes(
					query,
					PAGE_SIZE,
					offset,
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
		[query],
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
		let cancelled = false;
		const isQueryChange = prevQueryRef.current !== query;
		if (isQueryChange) {
			prevQueryRef.current = query;
		}
		const timeoutId = isQueryChange
			? setTimeout(() => {
					if (!cancelled) fetchNotes(false);
				}, 300)
			: undefined;
		if (!isQueryChange) {
			fetchNotes(false);
		}
		return () => {
			cancelled = true;
			if (timeoutId != null) clearTimeout(timeoutId);
		};
	}, [fetchNotes, query]);

	return {
		notes,
		hasMore,
		isLoading,
		loadMoreNotes,
		setQuery,
		query,
		error,
		handleRefresh,
	};
}
