import type { NoteListFilters } from "@/services/notes/types";
import type { SQLiteDatabase } from "expo-sqlite";
import { mapDbRowToIndexItem, mapIndexItemToSqlItem } from "./mapper";
import type {
	ListNotesResult,
	NoteIndexItem,
	NoteIndexRow,
	NoteIndexSqlItem,
} from "./types";

const TABLE = "note_index";
const FTS_TABLE = "note_index_fts";

export function buildFtsMatchQuery(query: string): string | null {
	const tokens = query.match(/[\p{L}\p{N}]+/gu) ?? [];
	if (tokens.length === 0) {
		return null;
	}

	return tokens.map((token) => `${token}*`).join(" ");
}

function getInsertPlaceholders(count: number): string {
	return Array.from({ length: count }, () => "(?, ?, ?, ?, ?, ?, ?)").join(
		", ",
	);
}

export async function hasRows(database: SQLiteDatabase): Promise<boolean> {
	const row = await database.getFirstAsync<{ count: number }>(
		`SELECT COUNT(1) as count FROM ${TABLE}`,
	);
	return (row?.count ?? 0) > 0;
}

export async function upsertItem(
	database: SQLiteDatabase,
	item: NoteIndexItem,
): Promise<void> {
	const sqlItem = mapIndexItemToSqlItem(item);
	await database.runAsync(
		`INSERT INTO ${TABLE} (
			id,
			title,
			summary,
			is_pinned,
			updated_at,
			note_type,
			status
		)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   title = excluded.title,
		   summary = excluded.summary,
		   is_pinned = excluded.is_pinned,
		   updated_at = excluded.updated_at,
		   note_type = excluded.note_type,
		   status = excluded.status`,
		sqlItem.id,
		sqlItem.title,
		sqlItem.summary,
		sqlItem.isPinned,
		sqlItem.updatedAt,
		sqlItem.noteType,
		sqlItem.status,
	);
}

export async function deleteById(
	database: SQLiteDatabase,
	noteId: string,
): Promise<void> {
	await database.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, noteId);
}

export async function listAll(
	database: SQLiteDatabase,
	query: string,
	limit: number,
	offset?: number,
	filters?: NoteListFilters,
): Promise<ListNotesResult> {
	const offsetVal = offset ?? 0;
	const normalizedQuery = query.trim();
	const ftsMatchQuery = buildFtsMatchQuery(normalizedQuery);
	const whereClauses: string[] = [];
	const params: (string | number)[] = [];

	if (ftsMatchQuery) {
		whereClauses.push(`${FTS_TABLE} MATCH ?`);
		params.push(ftsMatchQuery);
	}

	if (filters?.noteTypes && filters.noteTypes.length > 0) {
		const placeholders = filters.noteTypes.map(() => "?").join(", ");
		whereClauses.push(`${TABLE}.note_type IN (${placeholders})`);
		params.push(...filters.noteTypes);
	}

	if (filters?.status) {
		whereClauses.push(`${TABLE}.status = ?`);
		params.push(filters.status);
	}

	const whereSql =
		whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

	if (ftsMatchQuery) {
		const rows = await database.getAllAsync<NoteIndexRow>(
			`SELECT
				${TABLE}.id,
				${TABLE}.title,
				${TABLE}.summary,
				${TABLE}.is_pinned,
				${TABLE}.updated_at,
				${TABLE}.note_type,
				${TABLE}.status,
				bm25(${FTS_TABLE}, 1.0, 0.2) AS score
			FROM ${TABLE}
			JOIN ${FTS_TABLE} ON ${TABLE}.rowid = ${FTS_TABLE}.rowid
			${whereSql}
			ORDER BY
				is_pinned DESC,
				score,
				updated_at DESC
			LIMIT ? OFFSET ?`,
			...params,
			limit + 1,
			offsetVal,
		);

		return buildListResult(rows, limit, offsetVal);
	}

	const rows = await database.getAllAsync<NoteIndexRow>(
		`SELECT
			id,
			title,
			summary,
			is_pinned,
			updated_at,
			note_type,
			status
		FROM ${TABLE}
		${whereSql}
		ORDER BY is_pinned DESC, updated_at DESC
		LIMIT ? OFFSET ?`,
		...params,
		limit + 1,
		offsetVal,
	);

	return buildListResult(rows, limit, offsetVal);
}

function buildListResult(
	rows: NoteIndexRow[],
	limit: number,
	offset: number,
): ListNotesResult {
	const items: NoteIndexItem[] = rows.slice(0, limit).map(mapDbRowToIndexItem);
	const cursor = rows.length > limit ? offset + limit : undefined;
	return { items, cursor };
}

export async function upsertBatch(
	database: SQLiteDatabase,
	items: NoteIndexSqlItem[],
	batchSize: number,
): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const placeholders = getInsertPlaceholders(batch.length);
		const values = batch.flatMap((item) => [
			item.id,
			item.title,
			item.summary,
			item.isPinned,
			item.updatedAt,
			item.noteType,
			item.status,
		]);
		await database.runAsync(
			`INSERT INTO ${TABLE} (
				id,
				title,
				summary,
				is_pinned,
				updated_at,
				note_type,
				status
			)
			 VALUES ${placeholders}
			 ON CONFLICT(id) DO UPDATE SET
			   title = excluded.title,
			   summary = excluded.summary,
			   is_pinned = excluded.is_pinned,
			   updated_at = excluded.updated_at,
			   note_type = excluded.note_type,
			   status = excluded.status`,
			...values,
		);
	}
}

export async function deleteBatch(
	database: SQLiteDatabase,
	ids: string[],
	batchSize: number,
): Promise<void> {
	for (let i = 0; i < ids.length; i += batchSize) {
		const batch = ids.slice(i, i + batchSize);
		const placeholders = batch.map(() => "?").join(", ");
		await database.runAsync(
			`DELETE FROM ${TABLE} WHERE id IN (${placeholders})`,
			...batch,
		);
	}
}

export async function dropFtsTriggers(database: SQLiteDatabase): Promise<void> {
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_ai");
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_ad");
	await database.execAsync("DROP TRIGGER IF EXISTS note_index_au");
}

export async function createFtsTriggers(
	database: SQLiteDatabase,
): Promise<void> {
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

export async function clearTable(database: SQLiteDatabase): Promise<void> {
	await database.runAsync(`DELETE FROM ${TABLE}`);
}

export async function rebuildFts(database: SQLiteDatabase): Promise<void> {
	await database.execAsync(
		`INSERT INTO ${FTS_TABLE}(${FTS_TABLE}) VALUES('rebuild')`,
	);
}
