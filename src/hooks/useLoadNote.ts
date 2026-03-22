import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { useEffect, useState } from "react";

export function useLoadNote(id: string) {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const [note, setNote] = useState<Note | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initializationStatus === "pending") {
			setIsLoading(true);
			setError(null);
			return;
		}

		if (initializationStatus === "failed") {
			setNote(null);
			setIsLoading(false);
			setError(initializationError ?? "Storage is unavailable");
			return;
		}

		setIsLoading(true);
		setError(null);
		NoteService.loadNote(id)
			.then((loaded) => {
				setNote(loaded);
				if (!loaded) {
					setError("Note not found");
				}
			})
			.catch((err: unknown) => {
				setNote(null);
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => setIsLoading(false));
	}, [id, initializationStatus, initializationError]);

	return {
		isLoading,
		error,
		note,
	};
}
