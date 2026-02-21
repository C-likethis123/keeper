import {
	type ListNotesResult,
	notesIndexDbDelete,
	notesIndexDbGet,
	notesIndexDbListAll,
	notesIndexDbUpsert,
} from "./notesIndexDb";
import { NotesMetaService } from "./notesMetaService";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
}

export type { ListNotesResult };

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	async getNote(noteId: string): Promise<NoteIndexItem | null> {
		return notesIndexDbGet(noteId);
	}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await NotesMetaService.setPinned(item.noteId, item.isPinned);
		await NotesMetaService.setTitle(item.noteId, item.title);
		await notesIndexDbUpsert(item);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await NotesMetaService.removePin(noteId);
		await NotesMetaService.removeTitle(noteId);
		await notesIndexDbDelete(noteId);
	}

	static async listAllNotes(
		limit = 20,
		offset?: number,
		query?: string,
	): Promise<ListNotesResult> {
		return notesIndexDbListAll(limit, offset, query);
	}
}

export function extractSummary(markdown: string, maxLines = 6): string {
	const lines = markdown.split(/\r?\n/);
	const nonEmptyLines: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		nonEmptyLines.push(trimmed);
		if (nonEmptyLines.length >= maxLines) break;
	}
	return nonEmptyLines.join("\n");
}
