import { MIGRATIONS } from "@/migrations/migrations";
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
