import type { ListNotesResult, NoteIndexItem, extractSummary } from "./notesIndexDb";
import { getStorageEngine } from "@/services/storage/storageEngine";

export type { ListNotesResult, NoteIndexItem };
export { extractSummary } from "./notesIndexDb";

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await getStorageEngine().indexUpsert(item);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await getStorageEngine().indexDelete(noteId);
	}

	static async listNotes(
		query: string,
		limit = 20,
		offset?: number,
	): Promise<ListNotesResult> {
		return getStorageEngine().indexList(query, limit, offset);
	}

	static async rebuildFromDisk(): Promise<{ noteCount: number }> {
		return getStorageEngine().indexRebuildFromDisk();
	}
}
