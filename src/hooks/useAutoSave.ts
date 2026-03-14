import type { SaveStatus } from "@/components/SaveIndicator";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import { useEffect, useRef, useState } from "react";

type AutoSaveInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
};

export function useAutoSave({ id, title, isPinned }: AutoSaveInput) {
	const canWrite = useStorageStore((s) => s.capabilities.canWrite);
	const timerRef = useRef<number | null>(null);
	const lastSavedRef = useRef<Note | null>(null);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const getContent = useEditorState((s) => s.getContent);
	useEffect(() => {
		setStatus("idle");

		if (timerRef.current) {
			clearInterval(timerRef.current);
		}

		const runSave = async () => {
			if (!canWrite) return;
			const previousId = lastSavedRef.current?.id;
			const previousTitle = lastSavedRef.current?.title;
			const previousContent = lastSavedRef.current?.content;
			const previousIsPinned = lastSavedRef.current?.isPinned;
			const content = getContent();
			if (
				id !== previousId ||
				title !== previousTitle ||
				content !== previousContent ||
				isPinned !== previousIsPinned
			) {
				setStatus("saving");
				try {
					await NoteService.saveNote({
						id,
						title: title.trim(),
						content,
						isPinned,
						lastUpdated: Date.now(),
					});
				} catch {
					setStatus("idle");
					return;
				}
				lastSavedRef.current = {
					id,
					content,
					isPinned,
					title: title.trim(),
					lastUpdated: Date.now(),
				};
				setStatus("saved");
				setTimeout(() => {
					setStatus("idle");
				}, 1000);
			}
		};

		timerRef.current = setInterval(runSave, 10000);

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [id, title, isPinned, canWrite, getContent]);

	return { status };
}
