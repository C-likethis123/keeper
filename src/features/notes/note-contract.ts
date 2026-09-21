/** Platform-neutral persisted note shape. Keep this import-safe for Vite. */
export type CanonicalNoteType = "journal" | "resource" | "todo" | "note" | "template" | "drawing";
export type CanonicalNoteStatus = "open" | "blocked" | "doing" | "done";

export type CanonicalNote = {
	id: string;
	title: string;
	content: string;
	lastUpdated: number;
	isPinned: boolean;
	noteType: CanonicalNoteType;
	status: CanonicalNoteStatus | null;
	createdAt: number | null;
	completedAt: number | null;
	attachment: string | null;
	attachedVideo: string | null;
	resourceUrl: string | null;
	documentPositions: Record<string, string> | null;
	modified: number | null;
};
