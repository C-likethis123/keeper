import {
	getNotesForList,
	listKeyFromQuery,
	useNoteStore,
} from "@/stores/notes/noteStore";
import { useShallow } from "zustand/react/shallow";
import { useCallback, useEffect, useRef, useState } from "react";

export default function useNotes() {
	const [query, setQuery] = useState("");
	const listKey = listKeyFromQuery(query);
	const notes = useNoteStore(
		useShallow((state) => getNotesForList(state, listKey)),
	);
	const hasMore = useNoteStore(
		(state) => state.noteLists[listKey]?.hasMore ?? true,
	);
	const fetchList = useNoteStore((state) => state.fetchList);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const loadingRef = useRef(false);
	const prevQueryRef = useRef(query);
	const fetchNotes = useCallback(
		async (append: boolean) => {
			if (loadingRef.current) return;
			loadingRef.current = true;
			setIsLoading(true);
			try {
				await fetchList(listKey, { append });
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message);
				}
			} finally {
				loadingRef.current = false;
				setIsLoading(false);
			}
		},
		[listKey, fetchList],
	);

	const loadMoreNotes = useCallback(async () => {
		if (!hasMore || isLoading) return;
		await fetchNotes(true);
	}, [hasMore, isLoading, fetchNotes]);

	const handleRefresh = useCallback(async () => {
		setError(null);
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
