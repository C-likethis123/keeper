import { normalizeWikiLinkTitle } from "@/components/editor/wikilinks/wikiLinkUtils";
import { Directory, File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { NOTES_ROOT } from "../Notes";
import { parseWikiLinksFromBody } from "../wikiLinkParser";
import { mapWithConcurrency } from "./asyncUtils";
import { getNotesIndexDb } from "./db";
import { mapMarkdownFileToSqlItem } from "./mapper";
import {
	clearTable,
	createFtsTriggers,
	deleteAllWikiLinks,
	dropFtsTriggers,
	rebuildFts,
	upsertBatch,
} from "./repository";
import type { NoteIndexSqlItem, NotesIndexRebuildMetrics } from "./types";

const REBUILD_PARSE_CONCURRENCY = 8;
const REBUILD_PARSE_CHUNK_SIZE = 200;
const REBUILD_SQL_BATCH_SIZE = 100;

export async function rebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
	const rebuildStart = performance.now();
	const dir = new Directory(NOTES_ROOT);
	if (!dir.exists) {
		return {
			noteCount: 0,
			listMs: 0,
			readParseMs: 0,
			sqlInsertMs: 0,
			ftsRebuildMs: 0,
			totalMs: Math.round(performance.now() - rebuildStart),
		};
	}

	const listStart = performance.now();
	const markdownFiles = collectMarkdownFiles(dir);
	const listMs = Math.round(performance.now() - listStart);

	const parseStart = performance.now();
	const { rows, contentByNoteId } = await collectRows(markdownFiles);
	const readParseMs = Math.round(performance.now() - parseStart);

	const database = await getNotesIndexDb();
	let sqlInsertMs = 0;
	let ftsRebuildMs = 0;
	await database.withTransactionAsync(async () => {
		const sqlStart = performance.now();
		await dropFtsTriggers(database);
		await clearTable(database);
		await deleteAllWikiLinks(database);
		await upsertBatch(database, rows, REBUILD_SQL_BATCH_SIZE);

		// Build title->noteId map for wikilink resolution
		const titleToNoteId = new Map<string, string>();
		for (const row of rows) {
			titleToNoteId.set(normalizeWikiLinkTitle(row.title), row.id);
		}

		// Parse and insert wiki_links
		for (const row of rows) {
			const content = contentByNoteId.get(row.id) ?? "";
			const linkTitles = parseWikiLinksFromBody(content);
			const targetIds = linkTitles
				.map((title) => titleToNoteId.get(normalizeWikiLinkTitle(title)))
				.filter((id): id is string => id != null && id !== row.id);
			if (targetIds.length > 0) {
				const uniqueTargets = [...new Set(targetIds)];
				await insertWikiLinksBatch(database, row.id, uniqueTargets);
			}
		}

		sqlInsertMs = Math.round(performance.now() - sqlStart);

		const ftsStart = performance.now();
		await rebuildFts(database);
		await createFtsTriggers(database);
		ftsRebuildMs = Math.round(performance.now() - ftsStart);
	});

	const metrics: NotesIndexRebuildMetrics = {
		noteCount: rows.length,
		listMs,
		readParseMs,
		sqlInsertMs,
		ftsRebuildMs,
		totalMs: Math.round(performance.now() - rebuildStart),
	};
	console.log("[notesIndexDb] rebuildFromDisk metrics", metrics);
	return metrics;
}

async function insertWikiLinksBatch(
	database: SQLiteDatabase,
	sourceId: string,
	targetIds: string[],
): Promise<void> {
	const { insertWikiLinks } = await import("./repository");
	await insertWikiLinks(database, sourceId, targetIds);
}

function collectMarkdownFiles(dir: Directory): File[] {
	if (!dir.exists) {
		return [];
	}

	return dir
		.list()
		.filter(
			(entry): entry is File =>
				entry instanceof File && entry.name.endsWith(".md"),
		);
}

async function collectRows(markdownFiles: File[]): Promise<{
	rows: NoteIndexSqlItem[];
	contentByNoteId: Map<string, string>;
}> {
	const rows: NoteIndexSqlItem[] = [];
	const contentByNoteId = new Map<string, string>();
	for (
		let chunkStart = 0;
		chunkStart < markdownFiles.length;
		chunkStart += REBUILD_PARSE_CHUNK_SIZE
	) {
		const chunk = markdownFiles.slice(
			chunkStart,
			chunkStart + REBUILD_PARSE_CHUNK_SIZE,
		);
		const chunkRows = await mapWithConcurrency(
			chunk,
			REBUILD_PARSE_CONCURRENCY,
			async (entry) => {
				const content = await entry.text();
				const sqlItem = await mapMarkdownFileToSqlItem(entry);
				if (sqlItem) {
					contentByNoteId.set(sqlItem.id, content);
				}
				return sqlItem;
			},
		);
		for (const row of chunkRows) {
			if (row) {
				rows.push(row);
			}
		}
	}
	return { rows, contentByNoteId };
}
