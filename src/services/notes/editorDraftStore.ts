const DRAFT_PREFIX = "keeper:editorDraft:";

function getStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

export function getEditorDraftKey(noteId: string): string {
	return `${DRAFT_PREFIX}${noteId}`;
}

export function readEditorDraft(noteId: string): string | null {
	const storage = getStorage();
	if (!storage) return null;
	try {
		return storage.getItem(getEditorDraftKey(noteId));
	} catch {
		return null;
	}
}

export function writeEditorDraft(noteId: string, markdown: string): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(getEditorDraftKey(noteId), markdown);
	} catch {
		// Best-effort crash/quit recovery.
	}
}

export function clearEditorDraft(noteId: string, persistedMarkdown: string): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		if (storage.getItem(getEditorDraftKey(noteId)) === persistedMarkdown) {
			storage.removeItem(getEditorDraftKey(noteId));
		}
	} catch {
		// Best-effort cleanup.
	}
}
