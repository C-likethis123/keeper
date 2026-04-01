import type { GitChangedPaths } from "@/services/git/engines/GitEngine";
import { isIndexedNoteMarkdownPath } from "@/services/notes/templatePaths";
import type { NoteListFilters } from "@/services/notes/types";
import { getRuntimeStorageBackend } from "@/services/storage/runtime";
import { getStorageEngine } from "@/services/storage/storageEngine";
export { extractSummary } from "./indexDb/mapper";
import { syncChanges } from "./indexDb/syncService";
import type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
} from "./notesIndexDb";

export type { ListNotesResult, NoteIndexItem };

interface NotesIndexSyncResult {
	mode: "incremental" | "full_rebuild";
	changedPathCount: number;
	markdownChangedPathCount: number;
	metrics: NotesIndexSyncMetrics | NotesIndexRebuildMetrics;
}

export class NotesIndexService {
	static instance = new NotesIndexService();
	private static readonly storageEngine = getStorageEngine();

	private constructor() {}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await NotesIndexService.storageEngine.indexUpsert(item);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await NotesIndexService.storageEngine.indexDelete(noteId);
	}

	static async listNotes(
		query: string,
		limit = 20,
		offset?: number,
		filters?: NoteListFilters,
	): Promise<ListNotesResult> {
		return NotesIndexService.storageEngine.indexList(
			query,
			limit,
			offset,
			filters,
		);
	}

	static async rebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return NotesIndexService.storageEngine.indexRebuildFromDisk();
	}

	static async syncChangedPaths(
		changedPaths: GitChangedPaths,
	): Promise<NotesIndexSyncResult> {
		const changedPathCount =
			changedPaths.added.length +
			changedPaths.modified.length +
			changedPaths.deleted.length;
		const markdownChangedPathCount = [
			...changedPaths.added,
			...changedPaths.modified,
			...changedPaths.deleted,
		].filter(isIndexedNoteMarkdownPath).length;
		if (getRuntimeStorageBackend() === "mobile-native") {
			return {
				mode: "incremental",
				changedPathCount,
				markdownChangedPathCount,
				metrics: await syncChanges(changedPaths),
			};
		}

		return {
			mode: "full_rebuild",
			changedPathCount,
			markdownChangedPathCount,
			metrics: await NotesIndexService.rebuildFromDisk(),
		};
	}
}
