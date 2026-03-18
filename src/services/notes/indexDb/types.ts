import type {
	NoteListFilters,
	NoteStatus,
	NoteType,
} from "@/services/notes/types";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
	noteType: NoteType;
	status?: NoteStatus;
}

export interface ListNotesResult {
	items: NoteIndexItem[];
	cursor?: number;
}

export interface NotesIndexRebuildMetrics {
	noteCount: number;
	listMs?: number;
	readParseMs?: number;
	sqlInsertMs?: number;
	ftsRebuildMs?: number;
	totalMs?: number;
}

export interface NotesIndexSyncMetrics {
	mode: "incremental";
	addedCount: number;
	modifiedCount: number;
	deletedCount: number;
	markdownUpsertPathCount: number;
	markdownDeleteCount: number;
	upsertedNoteCount: number;
	deletedNoteCount: number;
	readParseMs: number;
	sqlMs: number;
	totalMs: number;
}

export interface NoteIndexSyncChangedPaths {
	added: string[];
	modified: string[];
	deleted: string[];
}

export interface NoteIndexRow {
	id: string;
	title: string;
	summary: string;
	is_pinned: number;
	updated_at: number;
	note_type: NoteType | null;
	status: NoteStatus | null;
}

export interface NoteIndexSqlItem {
	id: string;
	title: string;
	summary: string;
	isPinned: number;
	updatedAt: number;
	noteType: NoteType | null;
	status: NoteStatus | null;
}

export type NoteIndexFilters = NoteListFilters;
