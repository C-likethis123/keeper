export type NoteType = "journal" | "resource" | "todo" | "note";
export type NoteStatus = "open" | "blocked" | "doing" | "done";

export interface NoteListFilters {
	noteType?: NoteType;
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
