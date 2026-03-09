import type { Note } from "@/services/notes/types";
import type { NoteIndexListResult, NoteIndexPersistenceItem } from "@/services/storage/types";

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
	loadNote(id: string): Promise<Note | null>;
	saveNote(note: Note): Promise<Note>;
	deleteNote(id: string): Promise<boolean>;
	listNoteFiles(): Promise<NoteFileEntry[]>;
	statNote(id: string): Promise<number | null>;
	indexUpsert(item: NoteIndexPersistenceItem): Promise<void>;
	indexDelete(noteId: string): Promise<void>;
	indexList(
		query: string,
		limit: number,
		offset?: number,
	): Promise<NoteIndexListResult>;
	indexRebuildFromDisk(): Promise<{ noteCount: number }>;
}
