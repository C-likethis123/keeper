import { extractSummary } from "@/services/notes/indexDb/mapper";
import type {
	ListNotesResult,
	NoteIndexItem,
	NoteIndexRow,
	NotesIndexRebuildMetrics,
} from "@/services/notes/indexDb/types";
import type { Note, NoteListFilters } from "@/services/notes/types";
import { parseWikiLinksFromBody } from "@/services/notes/wikiLinkParser";
import { storageEngine } from "@/services/storage/storageEngine";

export type { ListNotesResult, NoteIndexItem, NotesIndexRebuildMetrics };

function normalizeTitle(title: string): string {
	return title.trim().toLocaleLowerCase();
}

async function loadAllNotes(): Promise<Note[]> {
	const notes = await Promise.all(
		(await storageEngine.listNoteFiles()).map(({ id }) =>
			storageEngine.loadNote(id),
		),
	);
	return notes.filter((note): note is Note => note !== null);
}

function buildLinkGraph(notes: Note[]): Map<string, Set<string>> {
	const idsByTitle = new Map(
		notes.map((note) => [normalizeTitle(note.title), note.id]),
	);
	return new Map(
		notes.map((note) => [
			note.id,
			new Set(
				parseWikiLinksFromBody(note.content)
					.map((title) => idsByTitle.get(normalizeTitle(title)))
					.filter((id): id is string => id !== undefined),
			),
		]),
	);
}

export async function notesIndexDbHasRows(): Promise<boolean> {
	return (await storageEngine.indexList("", 1)).items.length > 0;
}

export async function notesIndexDbUpsert(item: NoteIndexItem): Promise<void> {
	await storageEngine.indexUpsert(item);
}

export async function notesIndexDbDelete(noteId: string): Promise<void> {
	await storageEngine.indexDelete(noteId);
}

export async function notesIndexDbGetById(
	noteId: string,
): Promise<NoteIndexItem | null> {
	const note = await storageEngine.loadNote(noteId);
	if (!note) return null;
	return {
		noteId: note.id,
		title: note.title,
		summary: note.noteType === "drawing" ? "Drawing" : extractSummary(note.content),
		isPinned: note.isPinned,
		updatedAt: note.lastUpdated,
		noteType: note.noteType,
		status: note.status,
	};
}

export async function notesIndexDbListAll(
	query: string,
	limit: number,
	offset?: number,
	filters?: NoteListFilters,
): Promise<ListNotesResult> {
	return storageEngine.indexList(query, limit, offset, filters);
}

export async function notesIndexDbGetBacklinks(
	noteId: string,
): Promise<string[]> {
	const graph = buildLinkGraph(await loadAllNotes());
	return [...graph.entries()]
		.filter(([, targets]) => targets.has(noteId))
		.map(([sourceId]) => sourceId);
}

export async function notesIndexDbGetOutgoingLinks(
	noteId: string,
): Promise<string[]> {
	const graph = buildLinkGraph(await loadAllNotes());
	return [...(graph.get(noteId) ?? [])];
}

export async function notesIndexDbGetOrphanedNotes(): Promise<string[]> {
	const notes = await loadAllNotes();
	const graph = buildLinkGraph(notes);
	const linkedIds = new Set<string>();
	for (const [sourceId, targets] of graph) {
		if (targets.size > 0) linkedIds.add(sourceId);
		for (const targetId of targets) linkedIds.add(targetId);
	}
	return notes.filter((note) => !linkedIds.has(note.id)).map((note) => note.id);
}

export async function notesIndexDbGetRecentlyEditedNotes(
	limit = 10,
	daysBack = 7,
): Promise<NoteIndexRow[]> {
	const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
	return (await loadAllNotes())
		.filter((note) => note.lastUpdated >= cutoff)
		.sort((left, right) => right.lastUpdated - left.lastUpdated)
		.slice(0, limit)
		.map((note) => ({
			id: note.id,
			title: note.title,
			summary:
				note.noteType === "drawing" ? "Drawing" : extractSummary(note.content),
			is_pinned: note.isPinned ? 1 : 0,
			updated_at: note.lastUpdated,
			note_type: note.noteType,
			status: note.status ?? null,
		}));
}
