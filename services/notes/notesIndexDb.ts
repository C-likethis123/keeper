import { Directory, File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { NOTES_ROOT } from "./Notes";
import type { NoteIndexItem } from "./notesIndex";
import { extractSummary } from "./notesIndex";
import { NotesMetaService } from "./notesMetaService";

const DB_NAME = "notes-index.db";
const TABLE = "note_index";
const SCHEMA_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (db) return db;
	db = await SQLite.openDatabaseAsync(DB_NAME);
	await db.execAsync("PRAGMA journal_mode = WAL");
	const row = await db.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);
	const version = row?.user_version ?? 0;
	if (version < SCHEMA_VERSION) {
		if (version === 0) {
			await db.execAsync(`
				CREATE TABLE IF NOT EXISTS ${TABLE} (
					id TEXT PRIMARY KEY NOT NULL,
					title TEXT,
					summary TEXT NOT NULL,
					is_pinned INTEGER NOT NULL DEFAULT 0,
					updated_at INTEGER NOT NULL
				)
			`);
		} else {
			await db.execAsync(`
				CREATE TABLE IF NOT EXISTS ${TABLE}_new (
					id TEXT PRIMARY KEY NOT NULL,
					title TEXT,
					summary TEXT NOT NULL,
					is_pinned INTEGER NOT NULL DEFAULT 0,
					updated_at INTEGER NOT NULL
				)
			`);
			await db.execAsync(`
				INSERT INTO ${TABLE}_new (id, title, summary, is_pinned, updated_at)
				SELECT id, title, summary, is_pinned, updated_at FROM ${TABLE}
			`);
			await db.execAsync(`DROP TABLE ${TABLE}`);
			await db.execAsync(`ALTER TABLE ${TABLE}_new RENAME TO ${TABLE}`);
		}
		await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
	}
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
		item.title ?? null,
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
): Promise<ListNotesResult> {
	const database = await getDb();
	let sql = `SELECT * FROM ${TABLE}`;
	const params: (string | number)[] = [];
	if (query?.trim()) {
		sql += " WHERE (title IS NOT NULL AND title LIKE ?) OR summary LIKE ?";
		const q = `%${query.trim()}%`;
		params.push(q, q);
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

export async function notesIndexDbEnsurePopulated(): Promise<void> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ n: number }>(
		`SELECT COUNT(*) as n FROM ${TABLE}`,
	);
	if ((row?.n ?? 0) > 0) return;
	await notesIndexDbRebuildFromDisk();
}

export async function notesIndexDbRebuildFromDisk(): Promise<void> {
	const dir = new Directory(NOTES_ROOT);
	if (!dir.exists) return;
	const [pinnedMap, titlesMap] = await Promise.all([
		NotesMetaService.getPinnedMap(),
		NotesMetaService.getTitlesMap(),
	]);
	const entries = dir.list();
	const database = await getDb();
	await database.withTransactionAsync(async () => {
		for (const entry of entries) {
			if (!(entry instanceof File) || !entry.name.endsWith(".md")) continue;
			const id = entry.name.replace(/\.md$/, "");
			const content = await entry.text();
			const mtime = entry.modificationTime ?? 0;
			const title =
				titlesMap[id] ??
				decodeURIComponent(entry.name.replace(/\.md$/, "") || "Untitled");
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
				pinnedMap[id] ? 1 : 0,
				mtime,
			);
		}
	});
}
