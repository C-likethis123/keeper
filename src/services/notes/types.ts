export type NoteType = "journal" | "resource" | "todo" | "note" | "template";
export type NoteStatus = "open" | "blocked" | "doing" | "done";

export interface NoteListFilters {
	noteTypes?: NoteType[];
	status?: NoteStatus;
	hideDone?: boolean;
}

export interface Note {
	id: string;
	title: string;
	content: string;
	lastUpdated: number;
	isPinned: boolean;
	noteType: NoteType;
	status?: NoteStatus | null;
	createdAt?: number | null;
	completedAt?: number | null;
	attachment?: string | null;
	modified?: number | null;
}

export type NoteSaveInput = Omit<Note, "lastUpdated">;
