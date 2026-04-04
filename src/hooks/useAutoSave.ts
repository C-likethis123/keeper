import type { SaveStatus } from "@/components/SaveIndicator";
import { GitService } from "@/services/git/gitService";
import {
	normalizeMarkdownForPersistence,
	persistEditorEntry,
} from "@/services/notes/editorEntryPersistence";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

const AUTO_SAVE_INTERVAL_MS = 60000;
const INPUT_IDLE_BEFORE_SAVE_MS = 1500;
const SAVE_INDICATOR_DELAY_MS = 1000;

type AutoSaveInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	noteType: Note["noteType"];
	status?: Note["status"];
	initialNoteType?: Note["noteType"];
	onPersisted?: (noteType: Note["noteType"]) => void;
	isNew?: boolean;
};

export function useAutoSave({
	id,
	title,
	content: initialContent,
	isPinned,
	noteType,
	status: noteStatus,
	initialNoteType,
	onPersisted,
	isNew,
}: AutoSaveInput) {
	const getContentForVersion = useEditorState((s) => s.getContentForVersion);
	const prepareContent = useEditorState((s) => s.prepareContent);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const lastSavedRef = useRef<Note | null>(null);
	const latestNoteRef = useRef({
		id,
		title,
		isPinned,
		noteType,
		status: noteStatus,
	});
	const lastInputAtRef = useRef(Date.now());
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prepareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isSavingRef = useRef(false);
	const isNewEntryRef = useRef(!!isNew);
	const latestDocumentVersionRef = useRef(
		useEditorState.getState().document.version,
	);

	useEffect(() => {
		latestNoteRef.current = {
			id,
			title,
			isPinned,
			noteType,
			status: noteStatus,
		};
		lastInputAtRef.current = Date.now();

		if (lastSavedRef.current?.id !== id) {
			lastSavedRef.current = {
				id,
				title: title.trim(),
				content: normalizeMarkdownForPersistence(initialContent),
				isPinned,
				lastUpdated: Date.now(),
				noteType: initialNoteType ?? noteType,
				status: noteStatus,
			};
			isNewEntryRef.current = !!isNew;
			setStatus("idle");
		}
	}, [
		id,
		title,
		initialContent,
		isPinned,
		noteType,
		noteStatus,
		initialNoteType,
		isNew,
	]);

	const forceSave = useCallback(async () => {
		if (isSavingRef.current) {
			return;
		}

		const currentNote = latestNoteRef.current;
		const currentContent = getContentForVersion(
			latestDocumentVersionRef.current,
		);
		const trimmedTitle = currentNote.title.trim();

		const previousId = lastSavedRef.current?.id;
		const previousTitle = lastSavedRef.current?.title;
		const previousContent = lastSavedRef.current?.content;
		const previousIsPinned = lastSavedRef.current?.isPinned;
		const previousNoteType = lastSavedRef.current?.noteType;
		const previousStatus = lastSavedRef.current?.status;

		const isMatch =
			currentNote.id === previousId &&
			trimmedTitle === previousTitle &&
			currentContent === previousContent &&
			currentNote.isPinned === previousIsPinned &&
			currentNote.noteType === previousNoteType &&
			currentNote.status === previousStatus;

		if (isMatch) {
			return;
		}

		console.debug("[AutoSave] Dirty detected:", {
			id: {
				match: currentNote.id === previousId,
				a: currentNote.id,
				b: previousId,
			},
			title: {
				match: trimmedTitle === previousTitle,
				a: trimmedTitle,
				b: previousTitle,
			},
			content: {
				match: currentContent === previousContent,
				aLen: currentContent?.length,
				bLen: previousContent?.length,
			},
			pinned: {
				match: currentNote.isPinned === previousIsPinned,
				a: currentNote.isPinned,
				b: previousIsPinned,
			},
			type: {
				match: currentNote.noteType === previousNoteType,
				a: currentNote.noteType,
				b: previousNoteType,
			},
			status: {
				match: currentNote.status === previousStatus,
				a: currentNote.status,
				b: previousStatus,
			},
		});

		isSavingRef.current = true;
		setStatus("saving");
		const saveStart = performance.now();
		const currentIsNewEntry = isNewEntryRef.current;
		console.debug("[AutoSaveProfile] saveNote:start", {
			id: currentNote.id,
			titleLength: trimmedTitle.length,
			contentLength: currentContent.length,
			documentVersion: latestDocumentVersionRef.current,
			isNewEntry: currentIsNewEntry,
		});
		try {
			await persistEditorEntry({
				id: currentNote.id,
				title: trimmedTitle,
				content: currentContent,
				isPinned: currentNote.isPinned,
				noteType: currentNote.noteType,
				status: currentNote.status,
				previousNoteType: previousNoteType,
				isNewEntry: currentIsNewEntry,
			});
			isNewEntryRef.current = false;
		} catch {
			console.debug("[AutoSaveProfile] saveNote:error", {
				id: currentNote.id,
				durationMs: Math.round(performance.now() - saveStart),
			});
			setStatus("idle");
			isSavingRef.current = false;
			return;
		}
		console.debug("[AutoSaveProfile] saveNote:done", {
			id: currentNote.id,
			durationMs: Math.round(performance.now() - saveStart),
		});

		lastSavedRef.current = {
			id: currentNote.id,
			title: trimmedTitle,
			content: currentContent,
			isPinned: currentNote.isPinned,
			lastUpdated: Date.now(),
			noteType: currentNote.noteType,
			status: currentNote.status,
		};
		onPersisted?.(currentNote.noteType);
		isSavingRef.current = false;
		setStatus("saved");
		statusTimeoutRef.current = setTimeout(() => {
			setStatus("idle");
			statusTimeoutRef.current = null;
		}, SAVE_INDICATOR_DELAY_MS);
	}, [getContentForVersion, onPersisted]);

	useEffect(() => {
		let lastDocumentVersion = useEditorState.getState().document.version;
		const unsubscribe = useEditorState.subscribe((state) => {
			const nextDocumentVersion = state.document.version;
			if (nextDocumentVersion === lastDocumentVersion) {
				return;
			}
			lastDocumentVersion = nextDocumentVersion;
			latestDocumentVersionRef.current = nextDocumentVersion;
			lastInputAtRef.current = Date.now();

			if (prepareTimeoutRef.current) {
				clearTimeout(prepareTimeoutRef.current);
			}
			prepareTimeoutRef.current = setTimeout(() => {
				prepareTimeoutRef.current = null;
				void InteractionManager.runAfterInteractions(async () => {
					const prepareStart = performance.now();
					prepareContent();
					console.debug("[AutoSaveProfile] prepareContent", {
						documentVersion: latestDocumentVersionRef.current,
						durationMs: Math.round(performance.now() - prepareStart),
					});
				});
			}, INPUT_IDLE_BEFORE_SAVE_MS);
		});

		return () => {
			unsubscribe();
			if (prepareTimeoutRef.current) {
				clearTimeout(prepareTimeoutRef.current);
				prepareTimeoutRef.current = null;
			}
		};
	}, [prepareContent]);

	useEffect(() => {
		GitService.registerBackgroundSaveHandler(forceSave);

		return () => {
			GitService.registerBackgroundSaveHandler(null);
		};
	}, [forceSave]);

	useEffect(() => {
		if (statusTimeoutRef.current) {
			clearTimeout(statusTimeoutRef.current);
			statusTimeoutRef.current = null;
		}
		if (idleTimeoutRef.current) {
			clearTimeout(idleTimeoutRef.current);
			idleTimeoutRef.current = null;
		}
		if (prepareTimeoutRef.current) {
			clearTimeout(prepareTimeoutRef.current);
			prepareTimeoutRef.current = null;
		}
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		const scheduleSaveWhenIdle = () => {
			if (isSavingRef.current) {
				return;
			}

			const idleForMs = Date.now() - lastInputAtRef.current;
			const waitMs = Math.max(0, INPUT_IDLE_BEFORE_SAVE_MS - idleForMs);

			if (idleTimeoutRef.current) {
				clearTimeout(idleTimeoutRef.current);
			}

			idleTimeoutRef.current = setTimeout(() => {
				idleTimeoutRef.current = null;
				void InteractionManager.runAfterInteractions(async () => {
					await forceSave();
				});
			}, waitMs);
		};

		intervalRef.current = setInterval(
			scheduleSaveWhenIdle,
			AUTO_SAVE_INTERVAL_MS,
		);

		return () => {
			if (statusTimeoutRef.current) {
				clearTimeout(statusTimeoutRef.current);
				statusTimeoutRef.current = null;
			}
			if (idleTimeoutRef.current) {
				clearTimeout(idleTimeoutRef.current);
				idleTimeoutRef.current = null;
			}
			if (prepareTimeoutRef.current) {
				clearTimeout(prepareTimeoutRef.current);
				prepareTimeoutRef.current = null;
			}
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [forceSave]);

	return { status, forceSave };
}
