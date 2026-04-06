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
  return Array.from({ length: count }, () => "(?, ?, ?, ?, ?, ?, ?, ?)").join(
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
			status,
			modified
		)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   title = excluded.title,
		   summary = excluded.summary,
		   is_pinned = excluded.is_pinned,
		   updated_at = excluded.updated_at,
		   note_type = excluded.note_type,
		   status = excluded.status,
		   modified = excluded.modified`,
    sqlItem.id,
    sqlItem.title,
    sqlItem.summary,
    sqlItem.isPinned,
    sqlItem.updatedAt,
    sqlItem.noteType,
    sqlItem.status,
    sqlItem.modified ?? sqlItem.updatedAt,
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
  } else if (filters?.hideDone) {
    whereClauses.push(`(${TABLE}.status IS NULL OR ${TABLE}.status != 'done')`);
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
      item.modified ?? item.updatedAt,
    ]);
    await database.runAsync(
      `INSERT INTO ${TABLE} (
				id,
				title,
				summary,
				is_pinned,
				updated_at,
				note_type,
				status,
				modified
			)
			 VALUES ${placeholders}
			 ON CONFLICT(id) DO UPDATE SET
			   title = excluded.title,
			   summary = excluded.summary,
			   is_pinned = excluded.is_pinned,
			   updated_at = excluded.updated_at,
			   note_type = excluded.note_type,
			   status = excluded.status,
			   modified = excluded.modified`,
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

// ─── Wiki Links ───────────────────────────────────────────────

export async function insertWikiLinks(
  database: SQLiteDatabase,
  sourceId: string,
  targetIds: string[],
): Promise<void> {
  if (targetIds.length === 0) return;
  const placeholders = targetIds.map(() => "(?, ?)").join(", ");
  const values = targetIds.flatMap((targetId) => [sourceId, targetId]);
  await database.runAsync(
    `INSERT OR IGNORE INTO wiki_links (source_id, target_id) VALUES ${placeholders}`,
    ...values,
  );
}

export async function deleteLinksForNote(
  database: SQLiteDatabase,
  noteId: string,
): Promise<void> {
  await database.runAsync(
    "DELETE FROM wiki_links WHERE source_id = ? OR target_id = ?",
    noteId,
    noteId,
  );
}

export async function deleteAllWikiLinks(
  database: SQLiteDatabase,
): Promise<void> {
  await database.runAsync("DELETE FROM wiki_links");
}

// ─── Content Hash ─────────────────────────────────────────────

export async function getContentHash(
  database: SQLiteDatabase,
  noteId: string,
): Promise<string | null> {
  const row = await database.getFirstAsync<{ content_hash: string }>(
    "SELECT content_hash FROM content_hashes WHERE note_id = ?",
    noteId,
  );
  return row?.content_hash ?? null;
}

export async function setContentHash(
  database: SQLiteDatabase,
  noteId: string,
  hash: string,
): Promise<void> {
  await database.runAsync(
    "INSERT INTO content_hashes (note_id, content_hash) VALUES (?, ?) " +
      "ON CONFLICT(note_id) DO UPDATE SET content_hash = excluded.content_hash",
    noteId,
    hash,
  );
}

export async function deleteContentHash(
  database: SQLiteDatabase,
  noteId: string,
): Promise<void> {
  await database.runAsync(
    "DELETE FROM content_hashes WHERE note_id = ?",
    noteId,
  );
}

// ─── Graph Queries (Recursive CTEs) ───────────────────────────

/**
 * Get notes that link TO the given note (backlinks).
 */
export async function getBacklinks(
  database: SQLiteDatabase,
  noteId: string,
): Promise<string[]> {
  const rows = await database.getAllAsync<{ source_id: string }>(
    "SELECT source_id FROM wiki_links WHERE target_id = ?",
    noteId,
  );
  return (rows ?? []).map((r) => r.source_id);
}

/**
 * Get notes that the given note links TO (outgoing links).
 */
export async function getOutgoingLinks(
  database: SQLiteDatabase,
  noteId: string,
): Promise<string[]> {
  const rows = await database.getAllAsync<{ target_id: string }>(
    "SELECT target_id FROM wiki_links WHERE source_id = ?",
    noteId,
  );
  return (rows ?? []).map((r) => r.target_id);
}

/**
 * Get transitive backlinks using recursive CTE (notes that link to notes that link to this note).
 * Depth capped at 3 to avoid runaway queries.
 * TODO: debug this
 */
export async function getTransitiveBacklinks(
  database: SQLiteDatabase,
  noteId: string,
  maxDepth = 3,
): Promise<{ noteId: string; depth: number }[]> {
  const rows = await database.getAllAsync<{ source_id: string; depth: number }>(
    `
		WITH RECURSIVE backlinks(source_id, depth) AS (
			SELECT source_id, 1 FROM wiki_links WHERE target_id = ?
			UNION
			SELECT wl.source_id, bl.depth + 1
			FROM wiki_links wl
			JOIN backlinks bl ON wl.target_id = bl.source_id
			WHERE bl.depth < ?
		)
		SELECT DISTINCT source_id, MIN(depth) as depth
		FROM backlinks
		WHERE source_id != ?
		GROUP BY source_id
		`,
    noteId,
    maxDepth,
    noteId,
  );
  return (rows ?? []).map((r) => ({ noteId: r.source_id, depth: r.depth }));
}

/**
 * Get MOC (Map of Content) scores: count of outgoing links per note.
 * Notes with >= `minLinks` outgoing links are considered MOCs.
 */
export async function getMocScores(
  database: SQLiteDatabase,
  minLinks = 3,
): Promise<{ noteId: string; outgoingCount: number }[]> {
  const rows = await database.getAllAsync<{
    source_id: string;
    outgoing_count: number;
  }>(
    `
		SELECT source_id, COUNT(*) as outgoing_count
		FROM wiki_links
		GROUP BY source_id
		HAVING outgoing_count >= ?
		ORDER BY outgoing_count DESC
		`,
    minLinks,
  );
  return (rows ?? []).map((r) => ({
    noteId: r.source_id,
    outgoingCount: r.outgoing_count,
  }));
}

/**
 * Get the BFS neighborhood of a MOC note at a given depth.
 * Returns all notes reachable from `noteId` within `maxDepth` hops.
 */
export async function getGraphNeighborhood(
  database: SQLiteDatabase,
  noteId: string,
  maxDepth = 2,
): Promise<{ noteId: string; depth: number }[]> {
  const rows = await database.getAllAsync<{ target_id: string; depth: number }>(
    `
		WITH RECURSIVE neighborhood(target_id, depth) AS (
			SELECT target_id, 1 FROM wiki_links WHERE source_id = ?
			UNION
			SELECT wl.target_id, n.depth + 1
			FROM wiki_links wl
			JOIN neighborhood n ON wl.source_id = n.target_id
			WHERE n.depth < ?
		)
		SELECT DISTINCT target_id, MIN(depth) as depth
		FROM neighborhood
		WHERE target_id != ?
		GROUP BY target_id
		`,
    noteId,
    maxDepth,
    noteId,
  );
  return (rows ?? []).map((r) => ({ noteId: r.target_id, depth: r.depth }));
}

/**
 * Get orphaned notes: notes that have no incoming or outgoing wiki links.
 */
export async function getOrphanedNotes(
  database: SQLiteDatabase,
): Promise<string[]> {
  const rows = await database.getAllAsync<{ id: string }>(
    `
		SELECT n.id FROM note_index n
		WHERE n.id NOT IN (SELECT source_id FROM wiki_links)
		  AND n.id NOT IN (SELECT target_id FROM wiki_links)
		`,
  );
  return (rows ?? []).map((r) => r.id);
}

/**
 * Get recently edited notes: notes modified within the last `daysBack` days.
 */
export async function getRecentlyEditedNotes(
  database: SQLiteDatabase,
  limit = 10,
  daysBack = 7,
): Promise<NoteIndexRow[]> {
  const cutoffTimestamp = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const rows = await database.getAllAsync<NoteIndexRow>(
    `
		SELECT id, title, summary, is_pinned, updated_at, note_type, status, modified
		FROM note_index
		WHERE COALESCE(modified, updated_at) >= ?
		ORDER BY COALESCE(modified, updated_at) DESC
		LIMIT ?
		`,
    cutoffTimestamp,
    limit,
  );
  return rows ?? [];
}
