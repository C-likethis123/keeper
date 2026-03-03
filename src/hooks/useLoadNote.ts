import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useEffect, useState } from "react";

export function useLoadNote(id: string) {
	const [note, setNote] = useState<Note | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
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
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => setIsLoading(false));
	}, [id]);

	return {
		isLoading,
		error,
		note,
	};
}
