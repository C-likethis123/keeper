import { Note } from "@/services/notes/types";
import { useNoteStore } from "@/stores/notes/noteService";
import { useEffect, useState } from "react";

export function useLoadNote(filePath: string) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<Note | null>(null);
    const { loadNote } = useNoteStore();
    useEffect(() => {
        setIsLoading(true);
        loadNote(filePath).then((note) => {
            setNote(note);
            setIsLoading(false);
        }).catch((error) => {
            setError(error.message);
            setIsLoading(false);
        });
    }, [filePath]);
    return {
        isLoading,
        error,
        note,
        setNote,
    }
}