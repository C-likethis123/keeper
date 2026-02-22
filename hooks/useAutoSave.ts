import type { SaveStatus } from "@/components/SaveIndicator";
import type { Note } from "@/services/notes/types";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useEffect, useRef, useState } from "react";

type AutoSaveInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
};

export function useAutoSave({ id, title, content, isPinned }: AutoSaveInput) {
	const saveNote = useNoteStore((state) => state.saveNote);

	const timerRef = useRef<number | null>(null);
	const lastSavedRef = useRef<Note | null>(null);
	const [status, setStatus] = useState<SaveStatus>("idle");

	useEffect(() => {
		setStatus("idle");

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		const runSave = async () => {
			const previousId = lastSavedRef.current?.id;
			const previousTitle = lastSavedRef.current?.title;
			const previousContent = lastSavedRef.current?.content;
			const previousIsPinned = lastSavedRef.current?.isPinned;
			if (
				id !== previousId ||
				title !== previousTitle ||
				content !== previousContent ||
				isPinned !== previousIsPinned
			) {
				setStatus("saving");
				await saveNote({
					id,
					title: title.trim(),
					content,
					isPinned,
					lastUpdated: Date.now(),
				});
				lastSavedRef.current = {
					id,
					content,
					isPinned,
					title: title.trim(),
					lastUpdated: Date.now(),
				};
				setStatus("saved");
			}
		};

		timerRef.current = setTimeout(runSave, 2000);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [id, title, content, isPinned, saveNote]);

	return { status };
}
