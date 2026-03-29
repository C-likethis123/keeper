export type NoteType = "journal" | "resource" | "todo" | "note" | "template";
export type NoteStatus = "open" | "blocked" | "doing" | "done";

export interface NoteListFilters {
	noteTypes?: NoteType[];
	status?: NoteStatus;
}

export interface Note {
	id: string;
	title: string;
	content: string;
	lastUpdated: number;
	isPinned: boolean;
	noteType: NoteType;
	status?: NoteStatus;
}

export type NoteToSave = Omit<Note, "lastUpdated">;

export interface NoteTemplate {
	id: string;
	title: string;
	content: string;
	lastUpdated: number;
	noteType: NoteType;
	status?: NoteStatus;
}
