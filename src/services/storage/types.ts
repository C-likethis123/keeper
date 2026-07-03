import type {
	Note,
	NoteListFilters,
	NoteSaveInput,
	NoteStatus,
	NoteType,
} from "@/services/notes/types";
import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";

export interface StorageInitializeResult {
	notesRoot: string;
	needsRebuild: boolean;
}

export interface NoteFileEntry {
	id: string;
	updatedAt: number;
}

export interface NoteIndexPersistenceItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
	noteType: NoteType;
	status?: NoteStatus | null;
}

export interface NoteIndexListResult {
	items: NoteIndexPersistenceItem[];
	cursor?: number;
}

export type NoteIndexQueryFilters = NoteListFilters;

export interface StorageEngine {
	initialize(): Promise<StorageInitializeResult>;
	resetAllData(): Promise<void>;
	loadNote(id: string): Promise<Note | null>;
	saveNote(note: NoteSaveInput): Promise<Note>;
	deleteNote(id: string): Promise<boolean>;
	listNoteFiles(): Promise<NoteFileEntry[]>;
	statNote(id: string): Promise<number | null>;
	indexUpsert(item: NoteIndexPersistenceItem): Promise<void>;
	indexDelete(noteId: string): Promise<void>;
	indexList(
		query: string,
		limit: number,
		offset?: number,
		filters?: NoteIndexQueryFilters,
	): Promise<NoteIndexListResult>;
	indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics>;
}
