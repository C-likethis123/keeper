import type { NoteListFilters } from "@/services/notes/types";
import { getNotesIndexDb } from "./indexDb/db";
import { deleteById, hasRows, listAll, upsertItem } from "./indexDb/repository";
import type {
	ListNotesResult,
	NoteIndexItem,
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
