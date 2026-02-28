import { Directory, File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import * as SQLite from "expo-sqlite";
import matter from "gray-matter";
import { NOTES_ROOT } from "./Notes";
import type { NoteIndexItem } from "./notesIndex";
import { extractSummary } from "./notesIndex";

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

	if (currentDbVersion === 0) {
		await database.withTransactionAsync(async () => {
			await database.execAsync(`
				CREATE TABLE ${TABLE} (
					id TEXT PRIMARY KEY NOT NULL,
					title TEXT NOT NULL DEFAULT '',
					summary TEXT NOT NULL,
					is_pinned INTEGER NOT NULL DEFAULT 0,
					updated_at INTEGER NOT NULL
				)
			`);
			await database.execAsync("PRAGMA user_version = 1");
		});
		currentDbVersion = 1;
	}

	if (currentDbVersion === 1) {
		await database.withTransactionAsync(async () => {
			// Rebuild table: enforce title NOT NULL (existing rows may have NULL titles)
			await database.execAsync(`
				CREATE TABLE ${TABLE}_v2 (
					id TEXT PRIMARY KEY NOT NULL,
					title TEXT NOT NULL DEFAULT '',
					summary TEXT NOT NULL,
					is_pinned INTEGER NOT NULL DEFAULT 0,
					updated_at INTEGER NOT NULL
				)
			`);
			await database.execAsync(`
				INSERT INTO ${TABLE}_v2 (id, title, summary, is_pinned, updated_at)
				SELECT id, COALESCE(title, ''), summary, is_pinned, updated_at
				FROM ${TABLE}
			`);
			await database.execAsync(`DROP TABLE ${TABLE}`);
			await database.execAsync(`ALTER TABLE ${TABLE}_v2 RENAME TO ${TABLE}`);

			// Create FTS5 virtual table as a content table over note_index
			await database.execAsync(`
				CREATE VIRTUAL TABLE ${FTS_TABLE}
				USING fts5(title, summary, content='${TABLE}', content_rowid='rowid')
			`);

			// Populate FTS from existing rows
			await database.execAsync(`
				INSERT INTO ${FTS_TABLE}(rowid, title, summary)
				SELECT rowid, title, summary FROM ${TABLE}
			`);

			// Triggers to keep FTS in sync with note_index
			await database.execAsync(`
				CREATE TRIGGER ${TABLE}_ai AFTER INSERT ON ${TABLE} BEGIN
					INSERT INTO ${FTS_TABLE}(rowid, title, summary)
					VALUES (new.rowid, new.title, new.summary);
				END
			`);
			await database.execAsync(`
				CREATE TRIGGER ${TABLE}_ad AFTER DELETE ON ${TABLE} BEGIN
					INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, title, summary)
					VALUES ('delete', old.rowid, old.title, old.summary);
				END
			`);
			await database.execAsync(`
				CREATE TRIGGER ${TABLE}_au AFTER UPDATE ON ${TABLE} BEGIN
					INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, title, summary)
					VALUES ('delete', old.rowid, old.title, old.summary);
					INSERT INTO ${FTS_TABLE}(rowid, title, summary)
					VALUES (new.rowid, new.title, new.summary);
				END
			`);

			await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
		});
		currentDbVersion = 2;
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

export async function notesIndexDbGet(
	noteId: string,
): Promise<NoteIndexItem | null> {
	const database = await getDb();
	const row = await database.getFirstAsync<{
		id: string;
		title: string | null;
		summary: string;
		is_pinned: number;
		updated_at: number;
	}>(`SELECT * FROM ${TABLE} WHERE id = ?`, noteId);
	if (!row) return null;
	return {
		noteId: row.id,
		title: row.title ?? "",
		summary: row.summary,
		isPinned: row.is_pinned !== 0,
		updatedAt: row.updated_at,
	};
}

export async function notesIndexDbListAll(
	limit: number,
	offset?: number,
	query?: string,
	titleOnly?: boolean,
): Promise<ListNotesResult> {
	const database = await getDb();
	let sql = `SELECT * FROM ${TABLE}`;
	const params: (string | number)[] = [];
	if (query?.trim()) {
		const q = `%${query.trim()}%`;
		if (titleOnly) {
			sql += " WHERE title IS NOT NULL AND title LIKE ?";
			params.push(q);
		} else {
			sql += " WHERE (title IS NOT NULL AND title LIKE ?) OR summary LIKE ?";
			params.push(q, q);
		}
	}
	sql += " ORDER BY is_pinned DESC, updated_at DESC";
	const offsetVal = offset ?? 0;
	sql += " LIMIT ? OFFSET ?";
	params.push(limit + 1, offsetVal);
	const rows = await database.getAllAsync<{
		id: string;
		title: string | null;
		summary: string;
		is_pinned: number;
		updated_at: number;
	}>(sql, ...params);
	const items: NoteIndexItem[] = rows.slice(0, limit).map((row) => ({
		noteId: row.id,
		title: row.title ?? "",
		summary: row.summary,
		isPinned: row.is_pinned !== 0,
		updatedAt: row.updated_at,
	}));
	const nextCursor =
		rows.length > limit ? { offset: offsetVal + limit } : undefined;
	return { items, cursor: nextCursor };
}

export async function notesIndexDbRebuildFromDisk(): Promise<void> {
	const dir = new Directory(NOTES_ROOT);
	if (!dir.exists) return;
	const entries = dir.list();
	const database = await getDb();
	await database.runAsync(`DELETE FROM ${TABLE}`);
	await database.withTransactionAsync(async () => {
		for (const entry of entries) {
			if (!(entry instanceof File) || !entry.name.endsWith(".md")) continue;
			const id = entry.name.replace(/\.md$/, "");
			const { content, data } = matter(await entry.text());
			const mtime = entry.modificationTime ?? 0;
			const title = data.title ?? "";
			await database.runAsync(
				`INSERT INTO ${TABLE} (id, title, summary, is_pinned, updated_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET
				   title = excluded.title,
				   summary = excluded.summary,
				   is_pinned = excluded.is_pinned,
				   updated_at = excluded.updated_at`,
				id,
				title,
				extractSummary(content),
				data.pinned ? 1 : 0,
				mtime,
			);
		}
	});
}
