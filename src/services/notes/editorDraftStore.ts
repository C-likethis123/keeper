const DRAFT_PREFIX = "keeper:editorDraft:";

type EditorDraftRecord = {
	markdown: string;
	updatedAt: number;
};

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
		const value = storage.getItem(getEditorDraftKey(noteId));
		if (!value) return null;
		return parseEditorDraft(value).markdown;
	} catch {
		return null;
	}
}

export function writeEditorDraft(noteId: string, markdown: string): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(
			getEditorDraftKey(noteId),
			JSON.stringify({ markdown, updatedAt: Date.now() }),
		);
	} catch {
		// Best-effort crash/quit recovery.
	}
}

export function clearEditorDraft(
	noteId: string,
	persistedMarkdown: string,
	persistedAt = Date.now(),
): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		const value = storage.getItem(getEditorDraftKey(noteId));
		if (!value) return;
		const draft = parseEditorDraft(value);
		if (
			draft.markdown === persistedMarkdown ||
			draft.updatedAt <= persistedAt
		) {
			storage.removeItem(getEditorDraftKey(noteId));
		}
	} catch {
		// Best-effort cleanup.
	}
}

function parseEditorDraft(value: string): EditorDraftRecord {
	try {
		const parsed = JSON.parse(value) as Partial<EditorDraftRecord>;
		if (
			typeof parsed.markdown === "string" &&
			typeof parsed.updatedAt === "number"
		) {
			return { markdown: parsed.markdown, updatedAt: parsed.updatedAt };
		}
	} catch {
		// Legacy drafts were stored as plain markdown strings.
	}
	return { markdown: value, updatedAt: 0 };
}
