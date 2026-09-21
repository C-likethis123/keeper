import type { EditorSessionDraft } from "./editorSessionContract";

const normalizeMarkdownForPersistence = (markdown: string) => markdown.replace(/\r\n/g, "\n");

export function createEditorSessionDraft(draft: EditorSessionDraft): EditorSessionDraft {
	return { ...draft, content: normalizeMarkdownForPersistence(draft.content), status: draft.noteType === "todo" ? (draft.status ?? "open") : null, attachment: draft.attachment ?? null, attachedVideo: draft.attachedVideo ?? null, resourceUrl: draft.resourceUrl ?? null, documentPositions: draft.documentPositions ?? null };
}

export function patchEditorSessionDraft(draft: EditorSessionDraft, patch: Partial<Omit<EditorSessionDraft, "id">>): EditorSessionDraft {
	return createEditorSessionDraft({ ...draft, ...patch, content: patch.content === undefined ? draft.content : patch.content });
}

export function editorSessionDraftEqual(a: EditorSessionDraft, b: EditorSessionDraft): boolean {
	return a.id === b.id && a.title.trim() === b.title.trim() && a.content === b.content && a.isPinned === b.isPinned && a.noteType === b.noteType && a.status === b.status && a.attachment === b.attachment && a.attachedVideo === b.attachedVideo && a.resourceUrl === b.resourceUrl && JSON.stringify(a.documentPositions) === JSON.stringify(b.documentPositions);
}
