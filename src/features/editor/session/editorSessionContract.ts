import type { CanonicalNoteType, CanonicalNoteStatus } from "../../notes/note-contract";

export type EditorNoteType = CanonicalNoteType;
export type EditorNoteStatus = CanonicalNoteStatus;

export type EditorSessionDraft = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	noteType: EditorNoteType;
	status: EditorNoteStatus | null;
	attachment: string | null;
	attachedVideo: string | null;
	resourceUrl: string | null;
	documentPositions: Record<string, string> | null;
};

export type EditorPersistencePort = {
	save: (draft: EditorSessionDraft, options: { isNew: boolean }) => Promise<void>;
	remove: (noteId: string) => Promise<void>;
};

export function noteToEditorSessionDraft(note: EditorSessionDraft): EditorSessionDraft {
	return { id: note.id, title: note.title, content: note.content, isPinned: note.isPinned, noteType: note.noteType, status: note.status ?? null, attachment: note.attachment ?? null, attachedVideo: note.attachedVideo ?? null, resourceUrl: note.resourceUrl ?? null, documentPositions: note.documentPositions ?? null };
}
