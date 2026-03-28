import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import type {
	NoteIndexListResult,
	NoteIndexPersistenceItem,
	NoteIndexQueryFilters,
} from "@/services/storage/types";

export interface StorageInitializeResult {
	notesRoot: string;
	needsRebuild: boolean;
}

export interface NoteFileEntry {
	id: string;
	updatedAt: number;
}

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
