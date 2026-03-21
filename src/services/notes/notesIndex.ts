import type { GitChangedPaths } from "@/services/git/engines/GitEngine";
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

export type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
};

export interface NotesIndexSyncResult {
	mode: "incremental" | "full_rebuild";
	changedPathCount: number;
	markdownChangedPathCount: number;
	metrics: NotesIndexSyncMetrics | NotesIndexRebuildMetrics;
}

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	// REVIEW: can we cache getStorageEngine() as a instance level method?
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
		filters?: NoteListFilters,
	): Promise<ListNotesResult> {
		return getStorageEngine().indexList(query, limit, offset, filters);
	}

	static async rebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return getStorageEngine().indexRebuildFromDisk();
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
		].filter((path) => path.endsWith(".md")).length;
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
