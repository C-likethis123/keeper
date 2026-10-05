import { extractSummary } from "@/services/notes/noteSummary";
import type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
} from "@/services/notes/indexDb/types";
import type { Note } from "@/services/notes/types";
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

export async function notesIndexDbGetById(
	noteId: string,
): Promise<NoteIndexItem | null> {
	const note = await storageEngine.loadNote(noteId);
	if (!note) return null;
	return {
		noteId: note.id,
		title: note.title,
		summary:
			note.noteType === "drawing" ? "Drawing" : extractSummary(note.content),
		isPinned: note.isPinned,
		updatedAt: note.lastUpdated,
		noteType: note.noteType,
		status: note.status,
	};
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
