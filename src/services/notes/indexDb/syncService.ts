import { normalizeWikiLinkTitle } from "@/components/editor/wikilinks/wikiLinkUtils";
import {
	getNoteIdFromMarkdownPath,
	isIndexedNoteMarkdownPath,
} from "@/services/notes/templatePaths";
import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { NOTES_ROOT } from "../Notes";
import { parseWikiLinksFromBody } from "../wikiLinkParser";
import { mapWithConcurrency } from "./asyncUtils";
import { getNotesIndexDb } from "./db";
import { mapMarkdownPathToSqlItem } from "./mapper";
import {
	deleteBatch,
	deleteLinksForNote,
	getContentHash,
	insertWikiLinks,
	setContentHash,
	upsertBatch,
} from "./repository";
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
	const {
		items: upsertItems,
		readParseMs,
		contentByPath,
	} = await collectUpserts(markdownPaths);
	const deleteIds = changedPaths.deleted
		.filter(isIndexedNoteMarkdownPath)
		.map(getNoteIdFromMarkdownPath);

	const sqlStart = performance.now();
	// Keep SQL writes serialized inside one transaction to avoid SQLite lock churn.
	// We only parallelize markdown parsing/IO in collectUpserts.
	await database.withTransactionAsync(async () => {
		await upsertBatch(database, upsertItems, SYNC_BATCH_SIZE);
		await deleteBatch(database, deleteIds, SYNC_BATCH_SIZE);

		// Incremental wiki_links update
		for (const item of upsertItems) {
			const content = contentByPath.get(
				markdownPaths.find((p) => p.endsWith(`${item.id}.md`)) ?? "",
			);
			if (!content) continue;

			const oldHash = await getContentHash(database, item.id);
			const newHash = item.contentHash ?? null;
			if (oldHash === newHash) continue; // content unchanged

			// Delete old links and insert new ones
			await deleteLinksForNote(database, item.id);

			// Build title->noteId map for resolution
			const titleToNoteId = await buildTitleToNoteIdMap(database);
			const linkTitles = parseWikiLinksFromBody(content);
			const targetIds = linkTitles
				.map((title) => titleToNoteId.get(normalizeWikiLinkTitle(title)))
				.filter((id): id is string => id != null && id !== item.id);
			if (targetIds.length > 0) {
				const uniqueTargets = [...new Set(targetIds)];
				await insertWikiLinks(database, item.id, uniqueTargets);
			}

			if (newHash) {
				await setContentHash(database, item.id, newHash);
			}
		}

		// Cascade delete wiki_links for deleted notes
		for (const noteId of deleteIds) {
			await deleteLinksForNote(database, noteId);
		}
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

async function buildTitleToNoteIdMap(
	database: SQLiteDatabase,
): Promise<Map<string, string>> {
	const rows = await database.getAllAsync<{ id: string; title: string }>(
		"SELECT id, title FROM note_index",
	);
	const map = new Map<string, string>();
	for (const row of rows ?? []) {
		map.set(normalizeWikiLinkTitle(row.title), row.id);
	}
	return map;
}

async function collectUpserts(markdownPaths: string[]): Promise<{
	items: NoteIndexSqlItem[];
	readParseMs: number;
	contentByPath: Map<string, string>;
}> {
	const upsertItems: NoteIndexSqlItem[] = [];
	const contentByPath = new Map<string, string>();
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
			async (path) => {
				const file = new File(NOTES_ROOT, path);
				if (!file.exists) return null;
				const content = await file.text();
				const item = await mapMarkdownPathToSqlItem(path);
				if (item) {
					contentByPath.set(path, content);
				}
				return item;
			},
		);
		for (const item of parsedChunk) {
			if (item) {
				upsertItems.push(item);
			}
		}
	}

	const readParseMs = Math.round(performance.now() - readParseStart);
	return { items: upsertItems, readParseMs, contentByPath };
}
