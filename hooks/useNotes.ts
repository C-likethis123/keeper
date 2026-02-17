import { PAGE_SIZE } from "@/constants/pagination";
import { NoteIndexItem, NotesIndexService } from "@/services/notes/notesIndex";
import { Note } from "@/services/notes/types";
import { useCallback, useEffect, useRef, useState } from "react";
const toNote = (item: NoteIndexItem): Note => {
    const rawTitle =
        item.title ||
        (item.summary.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim()) ||
        item.noteId.split("/").pop()?.replace(/\.md$/, "") ||
        "Untitled";
    return {
        title: decodeURIComponent(rawTitle),
        content: item.summary,
        filePath: item.noteId,
        lastUpdated: item.updatedAt,
        isPinned: item.isPinned,
    };
};
export default function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<Record<string, unknown> | undefined>(undefined);
    const nextCursorRef = useRef<Record<string, unknown> | undefined>(undefined);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const [query, setQuery] = useState("");
    const prevQueryRef = useRef(query);
    const fetchNotes = useCallback(async (cursorOverride?: Record<string, unknown>) => {
        if (isLoading) return;
        setIsLoading(true);
        const c = cursorOverride !== undefined ? cursorOverride : cursor;
        try {
            const result = await NotesIndexService.instance.listAllNotes(PAGE_SIZE, c, query);
            const newItems = result.items.map(toNote);
            const isLoadMore = (c?.offset as number) > 0;
            setNotes((prev) => {
                const combined = isLoadMore ? [...prev, ...newItems] : newItems;
                const seen = new Set<string>();
                return combined.filter((n) => {
                    if (seen.has(n.filePath)) return false;
                    seen.add(n.filePath);
                    return true;
                });
            });
            nextCursorRef.current = result.cursor;
            setHasMore(!!result.cursor);
        } catch (error: unknown) {
            if (error instanceof Error) {
                setError(error.message);
            }
        } finally {
            setIsLoading(false);
        }
    }, [query, cursor]);

    const loadMoreNotes = useCallback(async () => {
        if (!hasMore || isLoading) return;
        setCursor(nextCursorRef.current);
    }, [hasMore, isLoading]);

    const handleRefresh = useCallback(async () => {
        setCursor(undefined);
        setHasMore(true);
        setError(null);
        await fetchNotes(undefined);
    }, [fetchNotes]);

    useEffect(() => {
        let cancelled = false;
        const isQueryChange = prevQueryRef.current !== query;
        if (isQueryChange) {
            prevQueryRef.current = query;
            setCursor(undefined);
            setHasMore(true);
        }
        const timeoutId = isQueryChange
            ? setTimeout(() => {
                (async () => {
                    if (!cancelled) fetchNotes(undefined);
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