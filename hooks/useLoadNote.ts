import { getNoteById, useNoteStore } from "@/stores/notes/noteStore";
import { useEffect, useState } from "react";

export function useLoadNote(id: string) {
	const note = useNoteStore((state) => getNoteById(state, id));
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const loadNote = useNoteStore((state) => state.loadNote);

	useEffect(() => {
		setIsLoading(true);
		setError(null);
		loadNote(id)
			.then((loaded) => {
				if (!loaded) {
					setError("Note not found");
				}
			})
			.catch((err: unknown) => {
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => setIsLoading(false));
	}, [id, loadNote]);
	return {
		isLoading,
		error,
		note,
	};
}
