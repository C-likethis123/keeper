import { MIGRATIONS } from "@/migrations/migrations";
import { parseFrontmatter, type ParsedFrontmatter } from "@/services/notes/frontmatter";
import { Directory, File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import * as SQLite from "expo-sqlite";
import { NOTES_ROOT } from "./Notes";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
}

export function extractSummary(markdown: string, maxLines = 6): string {
	const lines: string[] = [];
	let start = 0;

	for (let i = 0; i <= markdown.length; i += 1) {
		const atEnd = i === markdown.length;
		if (!atEnd && markdown[i] !== "\n") continue;

		let line = markdown.slice(start, i);
		if (line.endsWith("\r")) {
			line = line.slice(0, -1);
		}
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			lines.push(trimmed);
			if (lines.length >= maxLines) break;
		}
		start = i + 1;
	}

	return lines.join("\n");
}

const DB_NAME = "notes-index.db";
const TABLE = "note_index";
const FTS_TABLE = "note_index_fts";
const DATABASE_VERSION = 2;

let db: SQLite.SQLiteDatabase | null = null;

async function migrateDbIfNeeded(database: SQLiteDatabase): Promise<void> {
	const row = await database.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);
	let currentDbVersion = row?.user_version ?? 0;
	if (currentDbVersion >= DATABASE_VERSION) {
		return;
	}

	for (const migration of MIGRATIONS) {
		if (migration.version > currentDbVersion) {
			await migration.migrate(database);
			currentDbVersion = migration.version;
		}
	}
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (db) return db;
	db = await SQLite.openDatabaseAsync(DB_NAME);
	await db.execAsync("PRAGMA journal_mode = WAL");
	await migrateDbIfNeeded(db);
	return db;
}

export interface ListNotesResult {
	items: NoteIndexItem[];
	cursor?: { offset: number };
}

export async function notesIndexDbHasRows(): Promise<boolean> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ count: number }>(
		`SELECT COUNT(1) as count FROM ${TABLE}`,
	);
	return (row?.count ?? 0) > 0;
}

export async function notesIndexDbUpsert(item: NoteIndexItem): Promise<void> {
	const database = await getDb();
	await database.runAsync(
		`INSERT INTO ${TABLE} (id, title, summary, is_pinned, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   title = excluded.title,
		   summary = excluded.summary,
		   is_pinned = excluded.is_pinned,
		   updated_at = excluded.updated_at`,
		item.noteId,
		item.title ?? "",
		item.summary,
		item.isPinned ? 1 : 0,
		item.updatedAt,
	);
}

export async function notesIndexDbDelete(noteId: string): Promise<void> {
	const database = await getDb();
	await database.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, noteId);
}

export async function notesIndexDbListAll(
	query: string,
	limit: number,
	offset?: number,
): Promise<ListNotesResult> {
	const database = await getDb();
	const offsetVal = offset ?? 0;

	if (query.length > 0) {
		const q = query.trim();
		const ftsQuery = `${q}*`;

		const sql = `
			SELECT
				*,
				bm25(${FTS_TABLE}, 1.0, 0.2) AS score
			FROM ${TABLE}
			JOIN ${FTS_TABLE} ON ${TABLE}.rowid = ${FTS_TABLE}.rowid
			WHERE ${FTS_TABLE} MATCH ?
			ORDER BY
				is_pinned DESC,
				score,
				updated_at DESC
			LIMIT ? OFFSET ?
		`;

		const rows = await database.getAllAsync<{
			id: string;
			title: string;
			summary: string;
			is_pinned: number;
			updated_at: number;
		}>(sql, ftsQuery, limit + 1, offsetVal);

		const items: NoteIndexItem[] = rows.slice(0, limit).map((row) => ({
			noteId: row.id,
			title: row.title,
			summary: row.summary,
			isPinned: row.is_pinned !== 0,
			updatedAt: row.updated_at,
		}));
		const nextCursor =
			rows.length > limit ? { offset: offsetVal + limit } : undefined;
		return { items, cursor: nextCursor };
	}

	const sql = `
		SELECT * FROM ${TABLE}
		ORDER BY is_pinned DESC, updated_at DESC
		LIMIT ? OFFSET ?
	`;
	const rows = await database.getAllAsync<{
		id: string;
		title: string;
		summary: string;
		is_pinned: number;
		updated_at: number;
	}>(sql, limit + 1, offsetVal);

	const items: NoteIndexItem[] = rows.slice(0, limit).map((row) => ({
		noteId: row.id,
		title: row.title,
		summary: row.summary,
		isPinned: row.is_pinned !== 0,
		updatedAt: row.updated_at,
	}));
	const nextCursor =
		rows.length > limit ? { offset: offsetVal + limit } : undefined;
	return { items, cursor: nextCursor };
}

const SYNC_BATCH_SIZE = 20;
const SYNC_PARSE_CONCURRENCY = 8;
const SYNC_PARSE_CHUNK_SIZE = 100;
const REBUILD_PARSE_CONCURRENCY = 8;
const REBUILD_PARSE_CHUNK_SIZE = 200;
const REBUILD_SQL_BATCH_SIZE = 100;

interface RebuildRow {
	id: string;
	title: string;
	summary: string;
	isPinned: number;
	updatedAt: number;
}

export interface NotesIndexRebuildMetrics {
	noteCount: number;
	listMs?: number;
	readParseMs?: number;
	sqlInsertMs?: number;
	ftsRebuildMs?: number;
	totalMs?: number;
}

export interface NotesIndexSyncMetrics {
	mode: "incremental";
	addedCount: number;
	modifiedCount: number;
	deletedCount: number;
	markdownUpsertPathCount: number;
	markdownDeleteCount: number;
	upsertedNoteCount: number;
	deletedNoteCount: number;
	readParseMs: number;
	sqlMs: number;
	totalMs: number;
}

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (items.length === 0) return [];
	const maxConcurrency = Math.max(1, Math.min(concurrency, items.length));
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	const workers = Array.from({ length: maxConcurrency }, async () => {
		while (true) {
			const current = nextIndex;
			nextIndex += 1;
			if (current >= items.length) return;
			results[current] = await mapper(items[current], current);
		}
	});

	await Promise.all(workers);
	return results;
}

function getInsertPlaceholders(count: number): string {
	return Array.from({ length: count }, () => "(?, ?, ?, ?, ?)").join(", ");
}

function parseFrontmatterForIndex(markdown: string): ParsedFrontmatter {
	return parseFrontmatter(markdown);
}

async function dropFtsTriggers(database: SQLite.SQLiteDatabase): Promise<void> {
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_ai");
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_ad");
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_au");
}

async function createFtsTriggers(database: SQLite.SQLiteDatabase): Promise<void> {
	await database.execAsync(`
		CREATE TRIGGER IF NOT EXISTS note_index_ai AFTER INSERT ON note_index BEGIN
			INSERT INTO note_index_fts(rowid, title, summary)
			VALUES (new.rowid, new.title, new.summary);
		END
	`);
	await database.execAsync(`
		CREATE TRIGGER IF NOT EXISTS note_index_ad AFTER DELETE ON note_index BEGIN
			INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
			VALUES ('delete', old.rowid, old.title, old.summary);
		END
	`);
	await database.execAsync(`
		CREATE TRIGGER IF NOT EXISTS note_index_au AFTER UPDATE ON note_index BEGIN
			INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
			VALUES ('delete', old.rowid, old.title, old.summary);
			INSERT INTO note_index_fts(rowid, title, summary)
			VALUES (new.rowid, new.title, new.summary);
		END
	`);
}

export async function notesIndexDbSyncChanges(changedPaths: {
	added: string[];
	modified: string[];
	deleted: string[];
}): Promise<NotesIndexSyncMetrics> {
	const syncStart = performance.now();
	const database = await getDb();

	// Read all file data before opening the transaction
	const markdownPaths = [...changedPaths.added, ...changedPaths.modified].filter(
		(path) => path.endsWith(".md"),
	);
	const upsertItems: {
		id: string;
		title: string;
		summary: string;
		isPinned: number;
		mtime: number;
	}[] = [];
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
				const parsed = parseFrontmatterForIndex(await file.text());
				return {
					id: path.replace(/\.md$/, ""),
					title: parsed.title,
					summary: extractSummary(parsed.content),
					isPinned: parsed.isPinned ? 1 : 0,
					mtime: file.modificationTime ?? 0,
				};
			},
		);
		for (const item of parsedChunk) {
			if (item) upsertItems.push(item);
		}
	}
	const readParseMs = Math.round(performance.now() - readParseStart);

	const deleteIds = changedPaths.deleted
		.filter((path) => path.endsWith(".md"))
		.map((path) => path.replace(/\.md$/, ""));

	const sqlStart = performance.now();
	await database.withTransactionAsync(async () => {
		for (let i = 0; i < upsertItems.length; i += SYNC_BATCH_SIZE) {
			const batch = upsertItems.slice(i, i + SYNC_BATCH_SIZE);
			const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
			const values = batch.flatMap((item) => [
				item.id,
				item.title,
				item.summary,
				item.isPinned,
				item.mtime,
			]);
			await database.runAsync(
				`INSERT INTO ${TABLE} (id, title, summary, is_pinned, updated_at)
				 VALUES ${placeholders}
				 ON CONFLICT(id) DO UPDATE SET
				   title = excluded.title,
				   summary = excluded.summary,
				   is_pinned = excluded.is_pinned,
				   updated_at = excluded.updated_at`,
				...values,
			);
		}

		for (let i = 0; i < deleteIds.length; i += SYNC_BATCH_SIZE) {
			const batch = deleteIds.slice(i, i + SYNC_BATCH_SIZE);
			const placeholders = batch.map(() => "?").join(", ");
			await database.runAsync(
				`DELETE FROM ${TABLE} WHERE id IN (${placeholders})`,
				...batch,
			);
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

export async function notesIndexDbRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
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

	const tList = performance.now();
	const entries = dir.list();
	const markdownFiles = entries.filter(
		(entry): entry is File =>
			entry instanceof File && entry.name.endsWith(".md"),
	);
	const listMs = Math.round(performance.now() - tList);

	const tReadParse = performance.now();
	const rows: RebuildRow[] = [];
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
				const id = entry.name.replace(/\.md$/, "");
				const parsed = parseFrontmatterForIndex(await entry.text());
				return {
					id,
					title: parsed.title,
					summary: extractSummary(parsed.content),
					isPinned: parsed.isPinned ? 1 : 0,
					updatedAt: entry.modificationTime ?? 0,
				};
			},
		);
		rows.push(...chunkRows);
	}
	const readParseMs = Math.round(performance.now() - tReadParse);

	const database = await getDb();
	let sqlInsertMs = 0;
	let ftsRebuildMs = 0;
	await database.withTransactionAsync(async () => {
		const tSql = performance.now();
		await dropFtsTriggers(database);
		await database.runAsync(`DELETE FROM ${TABLE}`);

		for (let i = 0; i < rows.length; i += REBUILD_SQL_BATCH_SIZE) {
			const batch = rows.slice(i, i + REBUILD_SQL_BATCH_SIZE);
			const placeholders = getInsertPlaceholders(batch.length);
			const values = batch.flatMap((row) => [
				row.id,
				row.title,
				row.summary,
				row.isPinned,
				row.updatedAt,
			]);
			await database.runAsync(
				`INSERT INTO ${TABLE} (id, title, summary, is_pinned, updated_at)
				 VALUES ${placeholders}`,
				...values,
			);
		}

		sqlInsertMs = Math.round(performance.now() - tSql);

		const tFts = performance.now();
		await database.execAsync(
			`INSERT INTO ${FTS_TABLE}(${FTS_TABLE}) VALUES('rebuild')`,
		);
		await createFtsTriggers(database);
		ftsRebuildMs = Math.round(performance.now() - tFts);
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
