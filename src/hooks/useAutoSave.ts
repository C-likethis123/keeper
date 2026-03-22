import type { SaveStatus } from "@/components/SaveIndicator";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import { InteractionManager } from "react-native";
import { useEffect, useRef, useState } from "react";

const AUTO_SAVE_INTERVAL_MS = 60000;
const INPUT_IDLE_BEFORE_SAVE_MS = 1500;
const SAVE_INDICATOR_DELAY_MS = 1000;
const AUTO_SAVE_PROFILE = process.env.NODE_ENV === "development";

type AutoSaveInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	noteType: Note["noteType"];
	status?: Note["status"];
	initialNoteType?: Note["noteType"];
	onPersisted?: (noteType: Note["noteType"]) => void;
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
}: AutoSaveInput) {
	const canWrite = useStorageStore((s) => s.capabilities.canWrite);
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
	const latestDocumentVersionRef = useRef(useEditorState.getState().document.version);

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
				content: initialContent,
				isPinned,
				lastUpdated: Date.now(),
				noteType: initialNoteType ?? noteType,
				status: noteStatus,
			};
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
	]);

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
					if (AUTO_SAVE_PROFILE) {
						console.log("[AutoSaveProfile] prepareContent", {
							documentVersion: latestDocumentVersionRef.current,
							durationMs: Math.round(performance.now() - prepareStart),
						});
					}
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
			if (!canWrite || isSavingRef.current) {
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
					if (!canWrite || isSavingRef.current) {
						return;
					}

					const { id, title, isPinned, noteType, status } = latestNoteRef.current;
					const currentContent = getContentForVersion(
						latestDocumentVersionRef.current,
					);
					const previousId = lastSavedRef.current?.id;
					const previousTitle = lastSavedRef.current?.title;
					const previousContent = lastSavedRef.current?.content;
					const previousIsPinned = lastSavedRef.current?.isPinned;
					const previousNoteType = lastSavedRef.current?.noteType;
					const previousStatus = lastSavedRef.current?.status;

					if (
						id === previousId &&
						title === previousTitle &&
						currentContent === previousContent &&
						isPinned === previousIsPinned &&
						noteType === previousNoteType &&
						status === previousStatus
					) {
						return;
					}

					isSavingRef.current = true;
					setStatus("saving");
					const saveStart = performance.now();
					if (AUTO_SAVE_PROFILE) {
						console.log("[AutoSaveProfile] saveNote:start", {
							id,
							titleLength: title.length,
							contentLength: currentContent.length,
							documentVersion: latestDocumentVersionRef.current,
						});
					}
					try {
						await persistEditorEntry({
							id,
							title: title.trim(),
							content: currentContent,
							isPinned,
							lastUpdated: Date.now(),
							noteType,
							status,
							previousNoteType: previousNoteType,
						});
					} catch {
						if (AUTO_SAVE_PROFILE) {
							console.log("[AutoSaveProfile] saveNote:error", {
								id,
								durationMs: Math.round(performance.now() - saveStart),
							});
						}
						setStatus("idle");
						isSavingRef.current = false;
						return;
					}
					if (AUTO_SAVE_PROFILE) {
						console.log("[AutoSaveProfile] saveNote:done", {
							id,
							durationMs: Math.round(performance.now() - saveStart),
						});
					}

					lastSavedRef.current = {
						id,
						title: title.trim(),
						content: currentContent,
						isPinned,
						lastUpdated: Date.now(),
						noteType,
						status,
					};
					onPersisted?.(noteType);
					isSavingRef.current = false;
					setStatus("saved");
					statusTimeoutRef.current = setTimeout(() => {
						setStatus("idle");
						statusTimeoutRef.current = null;
					}, SAVE_INDICATOR_DELAY_MS);
				});
			}, waitMs);
		};

		intervalRef.current = setInterval(scheduleSaveWhenIdle, AUTO_SAVE_INTERVAL_MS);

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
	}, [canWrite, getContentForVersion, onPersisted]);

	return { status };
}
