import type { SaveStatus } from "@/components/SaveIndicator";
import { flushAllPendingEditorDispatches } from "@/components/editor/core/pendingDispatchRegistry";
import { GitService } from "@/services/git/gitService";
import {
	normalizeMarkdownForPersistence,
	persistEditorEntry,
} from "@/services/notes/editorEntryPersistence";
import type { Note } from "@/services/notes/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const AUTO_SAVE_INTERVAL_MS = 60000;
const SAVE_INDICATOR_DELAY_MS = 1000;

type AutoSaveInput = {
	id: string;
	title: string;
	content: string;
	currentContent: string;
	getCurrentContent: () => string;
	isPinned: boolean;
	noteType: Note["noteType"];
	status?: Note["status"];
	attachment?: Note["attachment"];
	attachedVideo?: Note["attachedVideo"];
	resourceUrl?: Note["resourceUrl"];
	documentPositions?: Note["documentPositions"];
	initialNoteType?: Note["noteType"];
	onPersisted?: () => void;
	isNew?: boolean;
};

export function useAutoSave({
	id,
	title,
	content: initialContent,
	currentContent,
	getCurrentContent,
	isPinned,
	noteType,
	status: noteStatus,
	attachment,
	attachedVideo,
	resourceUrl,
	documentPositions,
	initialNoteType,
	onPersisted,
	isNew,
}: AutoSaveInput) {
	const [status, setStatus] = useState<SaveStatus>("idle");
	const lastSavedRef = useRef<Note | null>(null);
	const latestNoteRef = useRef({
		id,
		title,
		isPinned,
		noteType,
		status: noteStatus,
		attachment,
		attachedVideo,
		resourceUrl,
		documentPositions,
	});
	const lastInputAtRef = useRef(Date.now());
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prepareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scheduleSaveWhenIdleRef = useRef<(() => void) | null>(null);
	const isSavingRef = useRef(false);
	const activeForceSaveRef = useRef<Promise<void> | null>(null);
	const saveAgainRequestedRef = useRef(false);
	const isNewEntryRef = useRef(!!isNew);
	const latestContentRef = useRef(normalizeMarkdownForPersistence(initialContent));
	const getCurrentContentRef = useRef(getCurrentContent);
	const latestInitialContentRef = useRef(
		normalizeMarkdownForPersistence(initialContent),
	);
	const hasEditorContentChangedRef = useRef(false);
	getCurrentContentRef.current = getCurrentContent;
	latestNoteRef.current = {
		id,
		title,
		isPinned,
		noteType,
		status: noteStatus,
		attachment,
		attachedVideo,
		resourceUrl,
		documentPositions,
	};

	useEffect(() => {
		const normalizedInitialContent =
			normalizeMarkdownForPersistence(initialContent);
		latestInitialContentRef.current = normalizedInitialContent;
		latestContentRef.current = normalizedInitialContent;
		lastInputAtRef.current = Date.now();

		if (lastSavedRef.current?.id !== id) {
			lastSavedRef.current = {
				id,
				title: title.trim(),
				content: normalizedInitialContent,
				isPinned,
				lastUpdated: Date.now(),
				noteType: initialNoteType ?? noteType,
				status: noteStatus,
				attachment,
				attachedVideo,
				resourceUrl,
				documentPositions,
			};
			isNewEntryRef.current = !!isNew;
			hasEditorContentChangedRef.current = false;
			setStatus("idle");
		} else if (
			title.trim() !== lastSavedRef.current.title ||
			isPinned !== lastSavedRef.current.isPinned ||
			noteType !== lastSavedRef.current.noteType ||
			noteStatus !== lastSavedRef.current.status ||
			attachment !== lastSavedRef.current.attachment ||
			attachedVideo !== lastSavedRef.current.attachedVideo ||
			resourceUrl !== lastSavedRef.current.resourceUrl ||
			documentPositions !== lastSavedRef.current.documentPositions
		) {
			scheduleSaveWhenIdleRef.current?.();
		}
	}, [
		id,
		title,
		initialContent,
		isPinned,
		noteType,
		noteStatus,
		attachment,
		attachedVideo,
		resourceUrl,
		documentPositions,
		initialNoteType,
		isNew,
	]);

	const forceSave = useCallback(async () => {
		if (activeForceSaveRef.current) {
			saveAgainRequestedRef.current = true;
			return activeForceSaveRef.current;
		}

		const savePromise = (async () => {
			isSavingRef.current = true;
			try {
				do {
					saveAgainRequestedRef.current = false;
					flushAllPendingEditorDispatches();

					const currentNote = latestNoteRef.current;
					const flushedContent = normalizeMarkdownForPersistence(
						getCurrentContentRef.current(),
					);
					latestContentRef.current = flushedContent;
					hasEditorContentChangedRef.current =
						flushedContent !== latestInitialContentRef.current;
					const currentContent = hasEditorContentChangedRef.current
						? flushedContent
						: (lastSavedRef.current?.content ??
							latestInitialContentRef.current);
					const trimmedTitle = currentNote.title.trim();

					const previousId = lastSavedRef.current?.id;
					const previousTitle = lastSavedRef.current?.title;
					const previousContent = lastSavedRef.current?.content;
					const previousIsPinned = lastSavedRef.current?.isPinned;
					const previousNoteType = lastSavedRef.current?.noteType;
					const previousStatus = lastSavedRef.current?.status;
					const previousAttachment = lastSavedRef.current?.attachment;
					const previousAttachedVideo = lastSavedRef.current?.attachedVideo;
					const previousResourceUrl = lastSavedRef.current?.resourceUrl;
					const previousDocumentPositions =
						lastSavedRef.current?.documentPositions;

					const isMatch =
						currentNote.id === previousId &&
						trimmedTitle === previousTitle &&
						currentContent === previousContent &&
						currentNote.isPinned === previousIsPinned &&
						currentNote.noteType === previousNoteType &&
						currentNote.status === previousStatus &&
						currentNote.attachment === previousAttachment &&
						currentNote.attachedVideo === previousAttachedVideo &&
						currentNote.resourceUrl === previousResourceUrl &&
						currentNote.documentPositions === previousDocumentPositions;

					if (isMatch) {
						continue;
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
						attachment: {
							match: currentNote.attachment === previousAttachment,
							a: currentNote.attachment,
							b: previousAttachment,
						},
						attachedVideo: {
							match: currentNote.attachedVideo === previousAttachedVideo,
							a: currentNote.attachedVideo,
							b: previousAttachedVideo,
						},
						resourceUrl: {
							match: currentNote.resourceUrl === previousResourceUrl,
							a: currentNote.resourceUrl,
							b: previousResourceUrl,
						},
						documentPositions: {
							match: currentNote.documentPositions === previousDocumentPositions,
							a: currentNote.documentPositions,
							b: previousDocumentPositions,
						},
					});

					setStatus("saving");
					const saveStart = performance.now();
					const currentIsNewEntry = isNewEntryRef.current;
					console.debug("[AutoSaveProfile] saveNote:start", {
						id: currentNote.id,
						titleLength: trimmedTitle.length,
						contentLength: currentContent.length,
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
							...(currentNote.attachment !== undefined
								? { attachment: currentNote.attachment }
								: {}),
							...(currentNote.attachedVideo !== undefined
								? { attachedVideo: currentNote.attachedVideo }
								: {}),
							...(currentNote.resourceUrl !== undefined
								? { resourceUrl: currentNote.resourceUrl }
								: {}),
							...(currentNote.documentPositions !== undefined
								? { documentPositions: currentNote.documentPositions }
								: {}),
							isNewEntry: currentIsNewEntry,
						});
						isNewEntryRef.current = false;
					} catch {
						console.debug("[AutoSaveProfile] saveNote:error", {
							id: currentNote.id,
							durationMs: Math.round(performance.now() - saveStart),
						});
						setStatus("idle");
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
						attachment: currentNote.attachment,
						attachedVideo: currentNote.attachedVideo,
						resourceUrl: currentNote.resourceUrl,
						documentPositions: currentNote.documentPositions,
					};
					onPersisted?.();
					setStatus("saved");
					statusTimeoutRef.current = setTimeout(() => {
						setStatus("idle");
						statusTimeoutRef.current = null;
					}, SAVE_INDICATOR_DELAY_MS);
				} while (saveAgainRequestedRef.current);
			} finally {
				isSavingRef.current = false;
				activeForceSaveRef.current = null;
			}
		})();

		activeForceSaveRef.current = savePromise;
		return savePromise;
	}, [onPersisted]);

	useEffect(() => {
		const nextContent = normalizeMarkdownForPersistence(currentContent);
		if (nextContent === latestContentRef.current) {
			return;
		}
		latestContentRef.current = nextContent;
		if (nextContent === latestInitialContentRef.current) {
			hasEditorContentChangedRef.current = false;
			return;
		}

		hasEditorContentChangedRef.current = true;
		lastInputAtRef.current = Date.now();
		scheduleSaveWhenIdleRef.current?.();
	}, [currentContent]);

	useEffect(() => {
		GitService.registerBackgroundSaveHandler(forceSave);

		return () => {
			GitService.registerBackgroundSaveHandler(null);
		};
	}, [forceSave]);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState !== "active") {
				void forceSave();
			}
		});

		return () => {
			subscription.remove();
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

		scheduleSaveWhenIdleRef.current = () => {
			if (isSavingRef.current) {
				saveAgainRequestedRef.current = true;
				return;
			}

			if (idleTimeoutRef.current) {
				clearTimeout(idleTimeoutRef.current);
			}

			idleTimeoutRef.current = setTimeout(() => {
				idleTimeoutRef.current = null;
				void forceSave();
			}, 0);
		};

		intervalRef.current = setInterval(
			() => scheduleSaveWhenIdleRef.current?.(),
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
			scheduleSaveWhenIdleRef.current = null;
		};
	}, [forceSave]);

	return { status, forceSave };
}
