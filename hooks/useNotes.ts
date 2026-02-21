import { PAGE_SIZE } from "@/constants/pagination";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { useCallback, useEffect, useRef, useState } from "react";
const toNote = (item: NoteIndexItem): Note => {
	return {
		id: item.noteId,
		title: item.title,
		content: item.summary,
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
	};
};
export default function useNotes() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [offset, setOffset] = useState<number | undefined>(undefined);
	const nextOffsetRef = useRef<number | undefined>(undefined);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(false);

	const [query, setQuery] = useState("");
	const prevQueryRef = useRef(query);
	const fetchNotes = useCallback(
		async (offsetOverride?: number) => {
			if (isLoading) return;
			setIsLoading(true);
			const off = offsetOverride !== undefined ? offsetOverride : offset;
			try {
				const result = await NotesIndexService.listAllNotes(
					PAGE_SIZE,
					off,
					query,
				);
				const newItems = result.items.map(toNote);
				const isLoadMore = (off ?? 0) > 0;
				setNotes((prev) => {
					const combined = isLoadMore ? [...prev, ...newItems] : newItems;
					const seen = new Set<string>();
					return combined.filter((n) => {
						if (seen.has(n.id)) return false;
						seen.add(n.id);
						return true;
					});
				});
				nextOffsetRef.current = result.cursor?.offset;
				setHasMore(!!result.cursor);
			} catch (error: unknown) {
				if (error instanceof Error) {
					setError(error.message);
				}
			} finally {
				setIsLoading(false);
			}
		},
		[query, offset, isLoading],
	);

	const loadMoreNotes = useCallback(async () => {
		if (!hasMore || isLoading) return;
		setOffset(nextOffsetRef.current);
	}, [hasMore, isLoading]);

	const handleRefresh = useCallback(async () => {
		setOffset(undefined);
		setHasMore(true);
		setError(null);
		await fetchNotes(0);
	}, [fetchNotes]);

	useEffect(() => {
		let cancelled = false;
		const isQueryChange = prevQueryRef.current !== query;
		if (isQueryChange) {
			prevQueryRef.current = query;
			setOffset(undefined);
			setHasMore(true);
		}
		const timeoutId = isQueryChange
			? setTimeout(() => {
					(async () => {
						if (!cancelled) fetchNotes(0);
					})();
				}, 300)
			: undefined;
		if (!isQueryChange) {
			(async () => {
				if (!cancelled) fetchNotes();
			})();
		}
		return () => {
			cancelled = true;
			if (timeoutId != null) clearTimeout(timeoutId);
		};
	}, [fetchNotes, query]);

	return {
		notes,
		setNotes,
		hasMore,
		isLoading,
		loadMoreNotes,
		setQuery,
		query,
		error,
		handleRefresh,
	};
}
