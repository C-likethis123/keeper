mod migrations;

use gray_matter::{engine::YAML, Matter};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Manager;

const NOTES_DIR: &str = "notes";
const INDEX_DB_NAME: &str = "notes-index.db";
const TABLE: &str = "note_index";
const FTS_TABLE: &str = "note_index_fts";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInitResult {
    pub notes_root: String,
    pub needs_rebuild: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFileEntry {
    pub id: String,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteNoteInput {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexUpsertInput {
    pub note_id: String,
    pub title: String,
    pub summary: String,
    pub is_pinned: bool,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexListInput {
    pub query: String,
    pub limit: i64,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexItem {
    pub note_id: String,
    pub title: String,
    pub summary: String,
    pub is_pinned: bool,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexCursor {
    pub offset: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexListResult {
    pub items: Vec<IndexItem>,
    pub cursor: Option<IndexCursor>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildMetrics {
    pub note_count: usize,
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))
}

fn notes_root_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(NOTES_DIR))
}

fn index_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(INDEX_DB_NAME))
}

fn ensure_storage_dirs(app: &tauri::AppHandle) -> Result<(), String> {
    let data_dir = app_data_dir(app)?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("failed to create app data dir: {e}"))?;
    let notes_dir = data_dir.join(NOTES_DIR);
    fs::create_dir_all(&notes_dir).map_err(|e| format!("failed to create notes dir: {e}"))?;
    Ok(())
}

fn sanitize_note_id(id: &str) -> Result<&str, String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("note id cannot be empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("invalid note id".to_string());
    }
    Ok(trimmed)
}

fn note_path_for_id(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    let clean_id = sanitize_note_id(id)?;
    let root = notes_root_path(app)?;
    Ok(root.join(format!("{clean_id}.md")))
}

fn file_mtime_ms(path: &Path) -> i64 {
    let modified = match fs::metadata(path).and_then(|m| m.modified()) {
        Ok(v) => v,
        Err(_) => return 0,
    };
    match modified.duration_since(UNIX_EPOCH) {
        Ok(v) => v.as_millis() as i64,
        Err(_) => 0,
    }
}

fn open_index_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = index_db_path(app)?;
    let conn = Connection::open(db_path).map_err(|e| format!("failed to open sqlite: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("failed to set sqlite pragmas: {e}"))?;
    migrations::migrate_if_needed(&conn)?;
    Ok(conn)
}

#[derive(Debug, Default, Deserialize)]
struct NoteFrontmatter {
    title: Option<String>,
    pinned: Option<bool>,
}

fn parse_frontmatter(markdown: &str) -> (String, bool, String) {
    let matter = Matter::<YAML>::new();
    let parsed = match matter.parse::<NoteFrontmatter>(markdown) {
        Ok(parsed) => parsed,
        Err(_) => return (String::new(), false, markdown.to_string()),
    };

    let frontmatter = parsed.data.unwrap_or_default();
    (
        frontmatter.title.unwrap_or_default(),
        frontmatter.pinned.unwrap_or(false),
        parsed.content,
    )
}

fn extract_summary(markdown_content: &str, max_lines: usize) -> String {
    let mut lines = Vec::new();
    for line in markdown_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        lines.push(trimmed.to_string());
        if lines.len() >= max_lines {
            break;
        }
    }
    lines.join("\n")
}

fn has_any_index_rows(conn: &Connection) -> Result<bool, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(1) FROM note_index", [], |row| row.get(0))
        .map_err(|e| format!("failed to count note_index: {e}"))?;
    Ok(count > 0)
}

#[tauri::command]
pub fn storage_initialize(app: tauri::AppHandle) -> Result<StorageInitResult, String> {
    ensure_storage_dirs(&app)?;
    let conn = open_index_db(&app)?;
    let needs_rebuild = !has_any_index_rows(&conn)?;
    let root = notes_root_path(&app)?;
    Ok(StorageInitResult {
        notes_root: root.to_string_lossy().to_string(),
        needs_rebuild,
    })
}

#[tauri::command]
pub fn read_note(app: tauri::AppHandle, id: String) -> Result<Option<String>, String> {
    let path = note_path_for_id(&app, &id)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| format!("failed to read note: {e}"))?;
    Ok(Some(content))
}

#[tauri::command]
pub fn write_note(app: tauri::AppHandle, input: WriteNoteInput) -> Result<i64, String> {
    ensure_storage_dirs(&app)?;
    let path = note_path_for_id(&app, &input.id)?;
    fs::write(&path, input.content).map_err(|e| format!("failed to write note: {e}"))?;
    Ok(file_mtime_ms(&path))
}

#[tauri::command]
pub fn delete_note(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let path = note_path_for_id(&app, &id)?;
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(path).map_err(|e| format!("failed to delete note: {e}"))?;
    Ok(true)
}

#[tauri::command]
pub fn list_note_files(app: tauri::AppHandle) -> Result<Vec<NoteFileEntry>, String> {
    ensure_storage_dirs(&app)?;
    let root = notes_root_path(&app)?;
    let mut out = Vec::new();
    let entries = fs::read_dir(root).map_err(|e| format!("failed to list notes dir: {e}"))?;
    for entry_result in entries {
        let entry = entry_result.map_err(|e| format!("failed to read dir entry: {e}"))?;
        let path = entry.path();
        if path.extension().and_then(|x| x.to_str()) != Some("md") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|x| x.to_str()) else {
            continue;
        };
        out.push(NoteFileEntry {
            id: stem.to_string(),
            updated_at: file_mtime_ms(&path),
        });
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}

#[tauri::command]
pub fn stat_note(app: tauri::AppHandle, id: String) -> Result<Option<i64>, String> {
    let path = note_path_for_id(&app, &id)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(file_mtime_ms(&path)))
}

#[tauri::command]
pub fn index_upsert(app: tauri::AppHandle, input: IndexUpsertInput) -> Result<(), String> {
    let conn = open_index_db(&app)?;
    conn.execute(
        &format!(
            "INSERT INTO {TABLE} (id, title, summary, is_pinned, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               summary = excluded.summary,
               is_pinned = excluded.is_pinned,
               updated_at = excluded.updated_at"
        ),
        params![
            input.note_id,
            input.title,
            input.summary,
            if input.is_pinned { 1 } else { 0 },
            input.updated_at,
        ],
    )
    .map_err(|e| format!("index_upsert failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn index_delete(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    let conn = open_index_db(&app)?;
    conn.execute(
        &format!("DELETE FROM {TABLE} WHERE id = ?1"),
        params![note_id],
    )
    .map_err(|e| format!("index_delete failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn index_list(app: tauri::AppHandle, input: IndexListInput) -> Result<IndexListResult, String> {
    let conn = open_index_db(&app)?;
    let offset = input.offset.unwrap_or(0).max(0);
    let limit_plus_one = (input.limit.max(1) + 1) as usize;
    let mut items = Vec::<IndexItem>::new();

    if !input.query.trim().is_empty() {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT
                   note_index.id,
                   note_index.title,
                   note_index.summary,
                   note_index.is_pinned,
                   note_index.updated_at
                 FROM {TABLE}
                 JOIN {FTS_TABLE} ON {TABLE}.rowid = {FTS_TABLE}.rowid
                 WHERE {FTS_TABLE} MATCH ?1
                 ORDER BY
                   note_index.is_pinned DESC,
                   bm25({FTS_TABLE}, 1.0, 0.2),
                   note_index.updated_at DESC
                 LIMIT ?2 OFFSET ?3"
            ))
            .map_err(|e| format!("index_list prepare failed: {e}"))?;
        let fts_query = format!("{}*", input.query.trim());
        let rows = stmt
            .query_map(params![fts_query, limit_plus_one as i64, offset], |row| {
                Ok(IndexItem {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    is_pinned: row.get::<_, i64>(3)? != 0,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| format!("index_list query failed: {e}"))?;
        for row in rows {
            items.push(row.map_err(|e| format!("index_list row decode failed: {e}"))?);
        }
    } else {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT id, title, summary, is_pinned, updated_at
                 FROM {TABLE}
                 ORDER BY is_pinned DESC, updated_at DESC
                 LIMIT ?1 OFFSET ?2"
            ))
            .map_err(|e| format!("index_list prepare failed: {e}"))?;
        let rows = stmt
            .query_map(params![limit_plus_one as i64, offset], |row| {
                Ok(IndexItem {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    is_pinned: row.get::<_, i64>(3)? != 0,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| format!("index_list query failed: {e}"))?;
        for row in rows {
            items.push(row.map_err(|e| format!("index_list row decode failed: {e}"))?);
        }
    }

    let has_more = items.len() > input.limit as usize;
    let cursor = if has_more {
        Some(IndexCursor {
            offset: offset + input.limit.max(1),
        })
    } else {
        None
    };
    if has_more {
        items.truncate(input.limit as usize);
    }
    Ok(IndexListResult { items, cursor })
}

#[tauri::command]
pub fn index_rebuild_from_disk(app: tauri::AppHandle) -> Result<RebuildMetrics, String> {
    ensure_storage_dirs(&app)?;
    let root = notes_root_path(&app)?;
    let conn = open_index_db(&app)?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("failed to start rebuild transaction: {e}"))?;

    tx.execute(&format!("DELETE FROM {TABLE}"), [])
        .map_err(|e| format!("failed to clear table: {e}"))?;

    let mut count: usize = 0;
    let entries = fs::read_dir(root).map_err(|e| format!("failed to list notes dir: {e}"))?;
    for entry_result in entries {
        let entry = entry_result.map_err(|e| format!("failed to read dir entry: {e}"))?;
        let path = entry.path();
        if path.extension().and_then(|x| x.to_str()) != Some("md") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|x| x.to_str()) else {
            continue;
        };
        let markdown =
            fs::read_to_string(&path).map_err(|e| format!("failed to read markdown: {e}"))?;
        let (title, is_pinned, content) = parse_frontmatter(&markdown);
        let summary = extract_summary(&content, 6);
        tx.execute(
            &format!(
                "INSERT INTO {TABLE} (id, title, summary, is_pinned, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                   title = excluded.title,
                   summary = excluded.summary,
                   is_pinned = excluded.is_pinned,
                   updated_at = excluded.updated_at"
            ),
            params![
                id,
                title,
                summary,
                if is_pinned { 1 } else { 0 },
                file_mtime_ms(&path),
            ],
        )
        .map_err(|e| format!("failed to insert note index row: {e}"))?;
        count += 1;
    }

    tx.execute(
        &format!("INSERT INTO {FTS_TABLE}({FTS_TABLE}) VALUES('rebuild')"),
        [],
    )
    .map_err(|e| format!("failed to rebuild fts: {e}"))?;

    tx.commit()
        .map_err(|e| format!("failed to commit rebuild transaction: {e}"))?;
    Ok(RebuildMetrics { note_count: count })
}

#[tauri::command]
pub fn notes_root_path_command(app: tauri::AppHandle) -> Result<String, String> {
    ensure_storage_dirs(&app)?;
    let root = notes_root_path(&app)?;
    Ok(root.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_frontmatter;

    #[test]
    fn parse_frontmatter_unescapes_quoted_titles() {
        let markdown = "---\ntitle: \"He said \\\"hi\\\"\"\npinned: true\n---\nHello";
        let (title, is_pinned, content) = parse_frontmatter(markdown);

        assert_eq!(title, "He said \"hi\"");
        assert!(is_pinned);
        assert_eq!(content, "Hello");
    }

    #[test]
    fn parse_frontmatter_falls_back_for_plain_markdown() {
        let markdown = "# Heading\n\nBody";
        let (title, is_pinned, content) = parse_frontmatter(markdown);

        assert_eq!(title, "");
        assert!(!is_pinned);
        assert_eq!(content, markdown);
    }

    #[test]
    fn parse_frontmatter_falls_back_for_invalid_yaml() {
        let markdown = "---\ntitle: \"unterminated\n---\nBody";
        let (title, is_pinned, content) = parse_frontmatter(markdown);

        assert_eq!(title, "");
        assert!(!is_pinned);
        assert_eq!(content, markdown);
    }
}
