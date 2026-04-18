import type { NoteListFilters } from "@/services/notes/types";
import { getNotesIndexDb } from "./indexDb/db";
import {
	deleteById,
	getBacklinks,
	getOrphanedNotes,
	getOutgoingLinks,
	getRecentlyEditedNotes,
	getTransitiveBacklinks,
	hasRows,
	listAll,
	upsertItem,
} from "./indexDb/repository";
import type {
	ListNotesResult,
	NoteIndexItem,
	NoteIndexRow,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
} from "./indexDb/types";

export type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
};

export async function notesIndexDbHasRows(): Promise<boolean> {
	const database = await getNotesIndexDb();
	return hasRows(database);
}

export async function notesIndexDbUpsert(item: NoteIndexItem): Promise<void> {
	const database = await getNotesIndexDb();
	await upsertItem(database, item);
}

export async function notesIndexDbDelete(noteId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await deleteById(database, noteId);
}

export async function notesIndexDbListAll(
	query: string,
	limit: number,
	offset?: number,
	filters?: NoteListFilters,
): Promise<ListNotesResult> {
	const database = await getNotesIndexDb();
	return listAll(database, query, limit, offset, filters);
}

// ─── Graph Query Wrappers ─────────────────────────────────────

export async function notesIndexDbGetBacklinks(
	noteId: string,
): Promise<string[]> {
	const database = await getNotesIndexDb();
	return getBacklinks(database, noteId);
}

export async function notesIndexDbGetOutgoingLinks(
	noteId: string,
): Promise<string[]> {
	const database = await getNotesIndexDb();
	return getOutgoingLinks(database, noteId);
}

export async function notesIndexDbGetTransitiveBacklinks(
	noteId: string,
	maxDepth = 3,
): Promise<{ noteId: string; depth: number }[]> {
	const database = await getNotesIndexDb();
	return getTransitiveBacklinks(database, noteId, maxDepth);
}

export async function notesIndexDbGetOrphanedNotes(): Promise<string[]> {
	const database = await getNotesIndexDb();
	return getOrphanedNotes(database);
}

export async function notesIndexDbGetRecentlyEditedNotes(
	limit = 10,
	daysBack = 7,
): Promise<NoteIndexRow[]> {
	const database = await getNotesIndexDb();
	return getRecentlyEditedNotes(database, limit, daysBack);
}
