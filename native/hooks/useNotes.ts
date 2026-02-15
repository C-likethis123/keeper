import { PAGE_SIZE } from "@/constants/pagination";
import { NoteIndexItem, NotesIndexService } from "@/services/notes/notesIndex";
import { Note } from "@/services/notes/types";
import { useCallback, useRef, useState } from "react";
const toNote = (item: NoteIndexItem): Note => ({
    title: item.title ||
        (item.summary.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim()) ||
        item.noteId.split("/").pop()?.replace(/\.md$/, "") ||
        "Untitled",
    content: item.summary,
    filePath: item.noteId,
    lastUpdated: item.updatedAt,
    isPinned: item.status === "PINNED",
});
export default function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<Record<string, unknown> | undefined>(undefined);
    const nextCursorRef = useRef<Record<string, unknown> | undefined>(undefined);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const [query, setQuery] = useState("");
    const fetchNotes = useCallback(async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            console.log("Fetching notes with query:", query, "and cursor:", cursor);
            const result = await NotesIndexService.instance.listAllNotes(PAGE_SIZE, cursor, query);
            console.log("Fetched notes:", result.items.map(toNote));
            setNotes(result.items.map(toNote));
            nextCursorRef.current = result.cursor;
            setHasMore(!!result.cursor);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Failed to fetch notes:", error);
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
        await fetchNotes();
    }, [fetchNotes]);

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