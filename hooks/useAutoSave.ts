import type { Note } from "@/services/notes/types";
import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useCallback, useEffect, useRef, useState } from "react";

type AutoSaveInput = {
	filePath: string;
	/** Title is read via a ref — changes to it never restart the auto-save timer. */
	title: string;
	content: string;
	isPinned: boolean;
	onSaved?: (note: Note) => void;
};

export function useAutoSave({
	filePath,
	title,
	content,
	isPinned,
	onSaved,
}: AutoSaveInput) {
	const { saveNote } = useNoteStore();
	const { setPinned } = useNotesMetaStore();

	// Kept as a ref so saveNow() always uses the latest title without
	// making title a dependency of the auto-save effect.
	const titleRef = useRef(title);
	titleRef.current = title;

	const timerRef = useRef<number | null>(null);
	const lastSavedRef = useRef<{ content: string; isPinned: boolean } | null>(
		null,
	);
	const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

	/**
	 * saveNow — call this imperatively (back-button, or title-input blur).
	 * Always saves with the latest title from the ref.
	 */
	const saveNow = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setStatus("saving");
		const saved = await saveNote({
			filePath,
			title: titleRef.current.trim() || "Untitled",
			content,
			isPinned,
		});
		lastSavedRef.current = { content, isPinned };
		setStatus("saved");
		onSaved?.(saved);
	}, [filePath, content, isPinned, saveNote, onSaved]);

	// Auto-save fires 2 s after content or isPinned changes.
	// Title is intentionally excluded — it is saved only via saveNow (on blur).
	useEffect(() => {
		setStatus("idle");

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		const runSave = async () => {
			const last = lastSavedRef.current;

			// Only-pin-changed optimisation: skip full file write.
			const onlyPinChanged =
				last && last.content === content && last.isPinned !== isPinned;
			if (onlyPinChanged && filePath) {
				await setPinned(filePath, isPinned);
				lastSavedRef.current = { content, isPinned };
				return;
			}

			setStatus("saving");
			const saved = await saveNote({
				filePath,
				title: titleRef.current.trim() || "Untitled",
				content,
				isPinned,
			});
			lastSavedRef.current = { content, isPinned };
			setStatus("saved");
			onSaved?.(saved);
		};

		timerRef.current = setTimeout(runSave, 2000);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filePath, content, isPinned]); // saveNote / onSaved are stable; titleRef is always current

	return { status, saveNow };
}
