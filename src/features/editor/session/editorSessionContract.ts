import type {
	CanonicalNoteType,
	CanonicalNoteStatus,
} from "../../notes/note-contract";

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
