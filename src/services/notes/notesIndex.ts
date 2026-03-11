import type { GitChangedPaths } from "@/services/git/engines/GitEngine";
import { getRuntimeStorageBackend } from "@/services/storage/runtime";
import { getStorageEngine } from "@/services/storage/storageEngine";
import {
	type ListNotesResult,
	type NoteIndexItem,
	notesIndexDbSyncChanges,
} from "./notesIndexDb";

export { extractSummary } from "./notesIndexDb";
export type { ListNotesResult, NoteIndexItem };

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

	static async syncChangedPaths(changedPaths: GitChangedPaths): Promise<void> {
		if (getRuntimeStorageBackend() === "mobile-native") {
			await notesIndexDbSyncChanges(changedPaths);
			return;
		}

		await NotesIndexService.rebuildFromDisk();
	}
}
