import type { NoteListFilters } from "@/services/notes/types";
import { storageEngine } from "@/services/storage/storageEngine";
export { extractSummary } from "./indexDb/mapper";
import type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
} from "./notesIndexDb";

export type { ListNotesResult, NoteIndexItem };

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await storageEngine.indexUpsert(item);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await storageEngine.indexDelete(noteId);
	}

	static async listNotes(
		query: string,
		limit = 20,
		offset?: number,
		filters?: NoteListFilters,
	): Promise<ListNotesResult> {
		return storageEngine.indexList(query, limit, offset, filters);
	}

	static async rebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return storageEngine.indexRebuildFromDisk();
	}

}
