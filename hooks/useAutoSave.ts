import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useCallback, useEffect, useRef, useState } from "react";

type AutoSaveInput = {
	filePath: string;
	title: string;
	content: string;
	isPinned: boolean;
};

export function useAutoSave({
	filePath,
	title,
	content,
	isPinned,
}: AutoSaveInput) {
	const { saveNote } = useNoteStore();
	const { setPinned } = useNotesMetaStore();

	const timerRef = useRef<number | null>(null);
	const lastSavedRef = useRef<{
		title: string;
		content: string;
		isPinned: boolean;
	} | null>(null);
	const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

	const saveNow = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		// #region agent log
		fetch(
			"http://127.0.0.1:7242/ingest/33637cfe-b39e-404b-b53c-7d1a9a880cbd",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Debug-Session-Id": "70fb90",
				},
				body: JSON.stringify({
					sessionId: "70fb90",
					runId: "initial",
					hypothesisId: "H1",
					location: "useAutoSave.ts:29",
					message: "useAutoSave.saveNow invoked",
					data: {
						filePath,
						title,
						isPinned,
					},
					timestamp: Date.now(),
				}),
			},
		).catch(() => {});
		// #endregion

		setStatus("saving");
		await saveNote({
			filePath,
			title: title.trim() || "Untitled",
			content,
			isPinned,
		});
		lastSavedRef.current = {
			title: title.trim() || "Untitled",
			content,
			isPinned,
		};
		setStatus("saved");
	}, [filePath, title, content, isPinned, saveNote]);

	useEffect(() => {
		setStatus("idle");

		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		const runSave = async () => {
			const trimmedTitle = title.trim() || "Untitled";
			const last = lastSavedRef.current;
			const onlyPinChanged =
				last &&
				last.title === trimmedTitle &&
				last.content === content &&
				last.isPinned !== isPinned;
			if (onlyPinChanged && filePath) {
				await setPinned(filePath, isPinned);
				lastSavedRef.current = { title: trimmedTitle, content, isPinned };
				return;
			}

			// #region agent log
			fetch(
				"http://127.0.0.1:7242/ingest/33637cfe-b39e-404b-b53c-7d1a9a880cbd",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Debug-Session-Id": "70fb90",
					},
					body: JSON.stringify({
						sessionId: "70fb90",
						runId: "initial",
						hypothesisId: "H2",
						location: "useAutoSave.ts:70",
						message: "useAutoSave.autosave runSave executed",
						data: {
							filePath,
							trimmedTitle,
							onlyPinChanged: !!onlyPinChanged,
						},
						timestamp: Date.now(),
					}),
				},
			).catch(() => {});
			// #endregion

			setStatus("saving");
			await saveNote({ filePath, title: trimmedTitle, content, isPinned });
			lastSavedRef.current = { title: trimmedTitle, content, isPinned };
			setStatus("saved");
		};

		timerRef.current = setTimeout(runSave, 2000);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [filePath, title, content, isPinned, saveNote]);

	return { status, saveNow };
}
