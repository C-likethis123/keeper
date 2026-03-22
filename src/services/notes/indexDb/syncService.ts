import { isIndexedNoteMarkdownPath } from "@/services/notes/templatePaths";
import { mapWithConcurrency } from "./asyncUtils";
import { getNotesIndexDb } from "./db";
import { mapMarkdownPathToSqlItem } from "./mapper";
import { deleteBatch, upsertBatch } from "./repository";
import type {
	NoteIndexSqlItem,
	NoteIndexSyncChangedPaths,
	NotesIndexSyncMetrics,
} from "./types";

const SYNC_BATCH_SIZE = 20;
const SYNC_PARSE_CONCURRENCY = 8;
const SYNC_PARSE_CHUNK_SIZE = 100;

export async function syncChanges(
	changedPaths: NoteIndexSyncChangedPaths,
): Promise<NotesIndexSyncMetrics> {
	const syncStart = performance.now();
	const database = await getNotesIndexDb();

	const markdownPaths = [
		...changedPaths.added,
		...changedPaths.modified,
	].filter(isIndexedNoteMarkdownPath);
	const { items: upsertItems, readParseMs } =
		await collectUpserts(markdownPaths);
	const deleteIds = changedPaths.deleted
		.filter(isIndexedNoteMarkdownPath)
		.map((path) => path.replace(/\.md$/, ""));

	const sqlStart = performance.now();
	// Keep SQL writes serialized inside one transaction to avoid SQLite lock churn.
	// We only parallelize markdown parsing/IO in collectUpserts.
	await database.withTransactionAsync(async () => {
		await upsertBatch(database, upsertItems, SYNC_BATCH_SIZE);
		await deleteBatch(database, deleteIds, SYNC_BATCH_SIZE);
	});

	const metrics: NotesIndexSyncMetrics = {
		mode: "incremental",
		addedCount: changedPaths.added.length,
		modifiedCount: changedPaths.modified.length,
		deletedCount: changedPaths.deleted.length,
		markdownUpsertPathCount: markdownPaths.length,
		markdownDeleteCount: deleteIds.length,
		upsertedNoteCount: upsertItems.length,
		deletedNoteCount: deleteIds.length,
		readParseMs,
		sqlMs: Math.round(performance.now() - sqlStart),
		totalMs: Math.round(performance.now() - syncStart),
	};
	console.log("[notesIndexDb] syncChanges metrics", metrics);
	return metrics;
}

async function collectUpserts(markdownPaths: string[]): Promise<{
	items: NoteIndexSqlItem[];
	readParseMs: number;
}> {
	const upsertItems: NoteIndexSqlItem[] = [];
	const readParseStart = performance.now();
	for (
		let chunkStart = 0;
		chunkStart < markdownPaths.length;
		chunkStart += SYNC_PARSE_CHUNK_SIZE
	) {
		const chunk = markdownPaths.slice(
			chunkStart,
			chunkStart + SYNC_PARSE_CHUNK_SIZE,
		);
		const parsedChunk = await mapWithConcurrency(
			chunk,
			SYNC_PARSE_CONCURRENCY,
			(path) => mapMarkdownPathToSqlItem(path),
		);
		for (const item of parsedChunk) {
			if (item) {
				upsertItems.push(item);
			}
		}
	}

	const readParseMs = Math.round(performance.now() - readParseStart);
	return { items: upsertItems, readParseMs };
}
