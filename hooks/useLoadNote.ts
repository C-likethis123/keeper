import type { Note } from "@/services/notes/types";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useEffect, useState } from "react";

export function useLoadNote(id: string) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [note, setNote] = useState<Note>({
		id,
		title: "",
		content: "",
		lastUpdated: Date.now(),
		isPinned: false,
	});
	const { loadNote } = useNoteStore();
	useEffect(() => {
		setIsLoading(true);
		loadNote(id)
			.then((loaded) => {
				if (loaded) {
					setNote(loaded);
				} else {
					setError("Note not found");
				}
			})
			.catch((err) => {
				setError(err.message);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [id, loadNote]);
	return {
		isLoading,
		error,
		note,
		setNote,
	};
}
