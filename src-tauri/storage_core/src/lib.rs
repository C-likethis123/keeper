mod migrations;

use gray_matter::{engine::YAML, Matter};
use rusqlite::{params, types::Value, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const TABLE: &str = "note_index";
const FTS_TABLE: &str = "note_index_fts";
pub const NOTES_DIR: &str = "notes";

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadNoteResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub last_updated: i64,
    pub note_type: String,
    pub status: Option<String>,
    pub created_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub attachment: Option<String>,
    pub attached_video: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteNoteInput {
    pub id: String,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub note_type: String,
    pub status: Option<String>,
    pub created_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub attachment: Option<String>,
    pub attached_video: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexUpsertInput {
    pub note_id: String,
    pub title: String,
    pub summary: String,
    pub is_pinned: bool,
    pub updated_at: i64,
    pub note_type: String,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexListInput {
    pub query: String,
    pub limit: i64,
    pub offset: Option<i64>,
    pub filters: Option<IndexListFilters>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexListFilters {
    pub note_type: Option<String>,
    pub status: Option<String>,
    pub hide_done: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexItem {
    pub note_id: String,
    pub title: String,
    pub summary: String,
    pub is_pinned: bool,
    pub updated_at: i64,
    pub note_type: String,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexListResult {
    pub items: Vec<IndexItem>,
    pub cursor: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildMetrics {
    pub note_count: usize,
}

fn notes_root(data_dir: &Path) -> PathBuf {
    data_dir.join(NOTES_DIR)
}

pub fn ensure_notes_dir(data_dir: &Path) -> Result<(), String> {
    let notes_root = notes_root(data_dir);
    fs::create_dir_all(data_dir).map_err(|e| format!("failed to create app data dir: {e}"))?;
    fs::create_dir_all(&notes_root).map_err(|e| format!("failed to create notes dir: {e}"))?;
    Ok(())
}

pub fn ensure_storage_dirs(data_dir: &Path) -> Result<(), String> {
    ensure_notes_dir(data_dir)?;
    Ok(())
}

pub fn reset_storage_dirs(
    data_dir: &Path,
    notes_root: &Path,
    index_db_path: &Path,
) -> Result<(), String> {
    if notes_root.exists() {
        fs::remove_dir_all(notes_root).map_err(|e| format!("failed to remove notes dir: {e}"))?;
    }

    if index_db_path.exists() {
        fs::remove_file(index_db_path).map_err(|e| format!("failed to remove index db: {e}"))?;
    }
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{}", index_db_path.to_string_lossy(), suffix));
        if sidecar.exists() {
            fs::remove_file(&sidecar)
                .map_err(|e| format!("failed to remove sqlite sidecar: {e}"))?;
        }
    }

    ensure_notes_dir(data_dir)
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

fn path_for_id(notes_root: &Path, id: &str) -> Result<PathBuf, String> {
    let clean_id = sanitize_note_id(id)?;
    Ok(notes_root.join(format!("{clean_id}.md")))
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

fn open_index_db(index_db_path: &Path) -> Result<Connection, String> {
    let conn =
        Connection::open(index_db_path).map_err(|e| format!("failed to open sqlite: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("failed to set sqlite pragmas: {e}"))?;
    migrations::migrate_if_needed(&conn)?;
    Ok(conn)
}

#[derive(Debug, Default, Deserialize)]
struct NoteFrontmatter {
    title: Option<String>,
    pinned: Option<bool>,
    #[serde(rename = "type")]
    note_type: Option<String>,
    status: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
    #[serde(rename = "completedAt")]
    completed_at: Option<i64>,
    attachment: Option<String>,
    #[serde(rename = "attachedVideo")]
    attached_video: Option<String>,
}

pub fn parse_frontmatter(
    markdown: &str,
) -> (
    String,
    bool,
    String,
    Option<String>,
    Option<i64>,
    Option<i64>,
    Option<String>,
    Option<String>,
    String,
) {
    let matter = Matter::<YAML>::new();
    let parsed = match matter.parse::<NoteFrontmatter>(markdown) {
        Ok(parsed) => parsed,
        Err(_) => {
            return (
                String::new(),
                false,
                "note".to_string(),
                None,
                None,
                None,
                None,
                None,
                markdown.to_string(),
            )
        }
    };

    let frontmatter = parsed.data.unwrap_or_default();
    (
        frontmatter.title.unwrap_or_default(),
        frontmatter.pinned.unwrap_or(false),
        frontmatter.note_type.unwrap_or_else(|| "note".to_string()),
        frontmatter.status,
        frontmatter.created_at,
        frontmatter.completed_at,
        frontmatter.attachment,
        frontmatter.attached_video,
        parsed.content,
    )
}

fn stringify_yaml_string(value: &str) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| format!("failed to serialize yaml string: {e}"))
}

fn serialize_entry(
    title: &str,
    id: &str,
    content: &str,
    note_type: &str,
    status: Option<&str>,
    created_at: Option<i64>,
    completed_at: Option<i64>,
    is_pinned: Option<bool>,
    attachment: Option<&str>,
    attached_video: Option<&str>,
) -> Result<String, String> {
    let matter = Matter::<YAML>::new();
    let delimiter = matter.delimiter;
    let close_delimiter = matter.close_delimiter.unwrap_or_else(|| delimiter.clone());
    let title = stringify_yaml_string(title.trim())?;
    let id = stringify_yaml_string(id.trim())?;
    let pinned = is_pinned.map(|value| {
        format!("\npinned: {}", if value { "true" } else { "false" })
    });

    Ok(format!(
        "{delimiter}{pinned}\ntitle: {title}\nid: {id}{note_type}{status}{created_at}{completed_at}{attachment}{attached_video}\n{close_delimiter}\n{content}",
        pinned = pinned.unwrap_or_default(),
        note_type = format!(
            "\ntype: {}",
            stringify_yaml_string(note_type).unwrap_or_else(|_| "\"note\"".to_string())
        ),
        status = if note_type == "todo" {
            format!(
                "\nstatus: {}",
                stringify_yaml_string(status.unwrap_or("open"))
                    .unwrap_or_else(|_| "\"open\"".to_string())
            )
        } else {
            String::new()
        },
        created_at = if note_type == "todo" {
            created_at
                .map(|value| format!("\ncreatedAt: {value}"))
                .unwrap_or_default()
        } else {
            String::new()
        },
        completed_at = if note_type == "todo" {
            completed_at
                .map(|value| format!("\ncompletedAt: {value}"))
                .unwrap_or_default()
        } else {
            String::new()
        },
        attachment = attachment
            .map(|value| {
                stringify_yaml_string(value)
                    .map(|v| format!("\nattachment: {v}"))
                    .unwrap_or_default()
            })
            .unwrap_or_default(),
        attached_video = attached_video
            .map(|value| {
                stringify_yaml_string(value)
                    .map(|v| format!("\nattachedVideo: {v}"))
                    .unwrap_or_default()
            })
            .unwrap_or_default()
    ))
}

pub fn serialize_note(input: &WriteNoteInput) -> Result<String, String> {
    serialize_entry(
        &input.title,
        &input.id,
        &input.content,
        &input.note_type,
        input.status.as_deref(),
        input.created_at,
        input.completed_at,
        if input.note_type == "template" {
            None
        } else {
            Some(input.is_pinned)
        },
        input.attachment.as_deref(),
        input.attached_video.as_deref(),
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

pub fn build_fts_match_query(query: &str) -> Option<String> {
    let tokens = query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(|token| format!("{token}*"))
        .collect::<Vec<_>>();

    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" "))
    }
}

fn has_any_index_rows(conn: &Connection) -> Result<bool, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(1) FROM note_index", [], |row| row.get(0))
        .map_err(|e| format!("failed to count note_index: {e}"))?;
    Ok(count > 0)
}

pub fn storage_initialize(
    notes_root: &Path,
    index_db_path: &Path,
) -> Result<StorageInitResult, String> {
    let data_dir = notes_root
        .parent()
        .ok_or_else(|| "notes root is missing parent data dir".to_string())?;
    ensure_storage_dirs(data_dir)?;
    let conn = open_index_db(index_db_path)?;
    let needs_rebuild = !has_any_index_rows(&conn)?;
    Ok(StorageInitResult {
        notes_root: notes_root.to_string_lossy().to_string(),
        needs_rebuild,
    })
}

pub fn read_note(notes_root: &Path, id: String) -> Result<Option<ReadNoteResult>, String> {
    let path = path_for_id(notes_root, &id)?;
    if !path.exists() {
        return Ok(None);
    }
    let markdown = fs::read_to_string(&path).map_err(|e| format!("failed to read note: {e}"))?;
    let (title, is_pinned, note_type, status, created_at, completed_at, attachment, attached_video, content) =
        parse_frontmatter(&markdown);
    Ok(Some(ReadNoteResult {
        id,
        title,
        content,
        is_pinned,
        last_updated: file_mtime_ms(&path),
        note_type,
        status,
        created_at,
        completed_at,
        attachment,
        attached_video,
    }))
}

pub fn write_note(notes_root: &Path, input: WriteNoteInput) -> Result<i64, String> {
    let data_dir = notes_root
        .parent()
        .ok_or_else(|| "notes root is missing parent data dir".to_string())?;
    ensure_storage_dirs(data_dir)?;
    let path = path_for_id(notes_root, &input.id)?;
    let markdown = serialize_note(&input)?;
    fs::write(&path, markdown).map_err(|e| format!("failed to write note: {e}"))?;
    Ok(file_mtime_ms(&path))
}

pub fn delete_note(notes_root: &Path, id: String) -> Result<bool, String> {
    let path = path_for_id(notes_root, &id)?;
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(path).map_err(|e| format!("failed to delete note: {e}"))?;
    Ok(true)
}

pub fn list_note_files(notes_root: &Path) -> Result<Vec<NoteFileEntry>, String> {
    let data_dir = notes_root
        .parent()
        .ok_or_else(|| "notes root is missing parent data dir".to_string())?;
    ensure_storage_dirs(data_dir)?;
    let mut out = Vec::new();
    let entries =
        fs::read_dir(notes_root).map_err(|e| format!("failed to list notes dir: {e}"))?;
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

pub fn stat_note(notes_root: &Path, id: String) -> Result<Option<i64>, String> {
    let path = path_for_id(notes_root, &id)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(file_mtime_ms(&path)))
}

pub fn index_upsert(index_db_path: &Path, input: IndexUpsertInput) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    let status = if input.note_type == "todo" {
        Some(input.status.as_deref().unwrap_or("open"))
    } else {
        None
    };
    conn.execute(
        &format!(
            "INSERT INTO {TABLE} (id, title, summary, is_pinned, updated_at, modified, note_type, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               summary = excluded.summary,
               is_pinned = excluded.is_pinned,
               updated_at = excluded.updated_at,
               modified = excluded.modified,
               note_type = excluded.note_type,
               status = excluded.status"
        ),
        params![
            input.note_id,
            input.title,
            input.summary,
            if input.is_pinned { 1 } else { 0 },
            input.updated_at,
            input.updated_at,
            input.note_type,
            status,
        ],
    )
    .map_err(|e| format!("index_upsert failed: {e}"))?;
    Ok(())
}

pub fn index_delete(index_db_path: &Path, note_id: String) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        &format!("DELETE FROM {TABLE} WHERE id = ?1"),
        params![note_id],
    )
    .map_err(|e| format!("index_delete failed: {e}"))?;
    Ok(())
}

// TODO: I'm sure I passed the correct filters to the frontend. But it's not showing up in backend
pub fn index_list(index_db_path: &Path, input: IndexListInput) -> Result<IndexListResult, String> {
    let conn = open_index_db(index_db_path)?;
    let offset = input.offset.unwrap_or(0).max(0);
    let limit_plus_one = (input.limit.max(1) + 1) as usize;
    let mut items = Vec::<IndexItem>::new();
    let normalized_query = input.query.trim().to_string();
    let fts_match_query = build_fts_match_query(&normalized_query);
    let filters = input.filters;

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<Value> = Vec::new();

    if let Some(fts_match_query) = fts_match_query.as_ref() {
        where_clauses.push("note_index_fts MATCH ?".to_string());
        params_vec.push(Value::Text(fts_match_query.clone()));
    }
    if let Some(note_type) = filters
        .as_ref()
        .and_then(|value| value.note_type.as_ref())
    {
        where_clauses.push("note_index.note_type = ?".to_string());
        params_vec.push(Value::Text(note_type.clone()));
    }
    if let Some(status) = filters.as_ref().and_then(|value| value.status.as_ref()) {
        where_clauses.push("note_index.status = ?".to_string());
        params_vec.push(Value::Text(status.clone()));
    } else if filters.as_ref().and_then(|f| f.hide_done).unwrap_or(false) {
        where_clauses.push("(note_index.status IS NULL OR note_index.status != 'done')".to_string());
    }
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    if fts_match_query.is_some() {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT
                   note_index.id,
                   note_index.title,
                   note_index.summary,
                   note_index.is_pinned,
                   note_index.updated_at,
                   note_index.note_type,
                   note_index.status
                 FROM {TABLE}
                 JOIN {FTS_TABLE} ON {TABLE}.rowid = {FTS_TABLE}.rowid
                 {where_sql}
                 ORDER BY
                   note_index.is_pinned DESC,
                   bm25({FTS_TABLE}, 1.0, 0.2),
                   note_index.updated_at DESC
                 LIMIT ? OFFSET ?"
            ))
            .map_err(|e| format!("index_list prepare failed: {e}"))?;
        params_vec.push(Value::Integer(limit_plus_one as i64));
        params_vec.push(Value::Integer(offset));
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
                Ok(IndexItem {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    is_pinned: row.get::<_, i64>(3)? != 0,
                    updated_at: row.get(4)?,
                    note_type: row.get(5)?,
                    status: row.get(6)?,
                })
            })
            .map_err(|e| format!("index_list query failed: {e}"))?;
        for row in rows {
            items.push(row.map_err(|e| format!("index_list row decode failed: {e}"))?);
        }
    } else {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT id, title, summary, is_pinned, updated_at, note_type, status
                 FROM {TABLE}
                 {where_sql}
                 ORDER BY is_pinned DESC, updated_at DESC
                 LIMIT ? OFFSET ?"
            ))
            .map_err(|e| format!("index_list prepare failed: {e}"))?;
        params_vec.push(Value::Integer(limit_plus_one as i64));
        params_vec.push(Value::Integer(offset));
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
                Ok(IndexItem {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    summary: row.get(2)?,
                    is_pinned: row.get::<_, i64>(3)? != 0,
                    updated_at: row.get(4)?,
                    note_type: row.get(5)?,
                    status: row.get(6)?,
                })
            })
            .map_err(|e| format!("index_list query failed: {e}"))?;
        for row in rows {
            items.push(row.map_err(|e| format!("index_list row decode failed: {e}"))?);
        }
    }

    let has_more = items.len() > input.limit as usize;
    let cursor = if has_more {
        Some(offset + input.limit.max(1))
    } else {
        None
    };
    if has_more {
        items.truncate(input.limit as usize);
    }
    Ok(IndexListResult { items, cursor })
}

pub fn index_rebuild_from_disk(
    notes_root: &Path,
    index_db_path: &Path,
) -> Result<RebuildMetrics, String> {
    let data_dir = notes_root
        .parent()
        .ok_or_else(|| "notes root is missing parent data dir".to_string())?;
    ensure_storage_dirs(data_dir)?;
    let conn = open_index_db(index_db_path)?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("failed to start rebuild transaction: {e}"))?;

    tx.execute(&format!("DELETE FROM {TABLE}"), [])
        .map_err(|e| format!("failed to clear table: {e}"))?;

    let mut count: usize = 0;
    let entries =
        fs::read_dir(notes_root).map_err(|e| format!("failed to list notes dir: {e}"))?;
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
        let (title, is_pinned, note_type, status, _, _, _, _, content) =
            parse_frontmatter(&markdown);
        let summary = extract_summary(&content, 6);
        let status = if note_type == "todo" {
            Some(status.as_deref().unwrap_or("open"))
        } else {
            None
        };
        tx.execute(
            &format!(
                "INSERT INTO {TABLE} (id, title, summary, is_pinned, updated_at, note_type, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                   title = excluded.title,
                   summary = excluded.summary,
                   is_pinned = excluded.is_pinned,
                   updated_at = excluded.updated_at,
                   note_type = excluded.note_type,
                   status = excluded.status"
            ),
            params![
                id,
                title,
                summary,
                if is_pinned { 1 } else { 0 },
                file_mtime_ms(&path),
                note_type,
                status,
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

// ─── Wiki Links ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiLinksUpsertInput {
    pub source_id: String,
    pub target_ids: Vec<String>,
}

pub fn wiki_links_upsert(
    index_db_path: &Path,
    input: WikiLinksUpsertInput,
) -> Result<(), String> {
    if input.target_ids.is_empty() {
        return Ok(());
    }
    let conn = open_index_db(index_db_path)?;
    let placeholders: Vec<String> = input.target_ids.iter().map(|_| "(?, ?)".to_string()).collect();
    let sql = format!(
        "INSERT OR IGNORE INTO wiki_links (source_id, target_id) VALUES {}",
        placeholders.join(", ")
    );
    let mut params_vec: Vec<Value> = Vec::new();
    for target_id in &input.target_ids {
        params_vec.push(Value::Text(input.source_id.clone()));
        params_vec.push(Value::Text(target_id.clone()));
    }
    conn.execute(&sql, rusqlite::params_from_iter(params_vec.iter()))
        .map_err(|e| format!("wiki_links_upsert failed: {e}"))?;
    Ok(())
}

pub fn wiki_links_delete_for_note(index_db_path: &Path, note_id: String) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "DELETE FROM wiki_links WHERE source_id = ? OR target_id = ?",
        params![note_id, note_id],
    )
    .map_err(|e| format!("wiki_links_delete_for_note failed: {e}"))?;
    Ok(())
}

pub fn wiki_links_delete_all(index_db_path: &Path) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute("DELETE FROM wiki_links", [])
        .map_err(|e| format!("wiki_links_delete_all failed: {e}"))?;
    Ok(())
}

// ─── Graph Queries ──────────────────────────────────────────────

pub fn wiki_links_get_backlinks(
    index_db_path: &Path,
    note_id: String,
) -> Result<Vec<String>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare("SELECT source_id FROM wiki_links WHERE target_id = ?")
        .map_err(|e| format!("wiki_links_get_backlinks prepare failed: {e}"))?;
    let rows = stmt
        .query_map(params![note_id], |row| row.get(0))
        .map_err(|e| format!("wiki_links_get_backlinks query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("wiki_links_get_backlinks row failed: {e}"))?);
    }
    Ok(result)
}

pub fn wiki_links_get_outgoing(
    index_db_path: &Path,
    note_id: String,
) -> Result<Vec<String>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare("SELECT target_id FROM wiki_links WHERE source_id = ?")
        .map_err(|e| format!("wiki_links_get_outgoing prepare failed: {e}"))?;
    let rows = stmt
        .query_map(params![note_id], |row| row.get(0))
        .map_err(|e| format!("wiki_links_get_outgoing query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("wiki_links_get_outgoing row failed: {e}"))?);
    }
    Ok(result)
}

pub fn wiki_links_get_orphaned_notes(index_db_path: &Path) -> Result<Vec<String>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT n.id FROM note_index n
             WHERE n.id NOT IN (SELECT source_id FROM wiki_links)
               AND n.id NOT IN (SELECT target_id FROM wiki_links)",
        )
        .map_err(|e| format!("wiki_links_get_orphaned_notes prepare failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("wiki_links_get_orphaned_notes query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("wiki_links_get_orphaned_notes row failed: {e}"))?);
    }
    Ok(result)
}

pub fn wiki_links_get_recently_edited(
    index_db_path: &Path,
    limit: i64,
    days_back: i64,
) -> Result<Vec<IndexItem>, String> {
    let conn = open_index_db(index_db_path)?;
    let cutoff_timestamp = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
        - (days_back * 24 * 60 * 60 * 1000);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, is_pinned, updated_at, note_type, status
             FROM note_index
             WHERE COALESCE(modified, updated_at) >= ?
             ORDER BY COALESCE(modified, updated_at) DESC
             LIMIT ?",
        )
        .map_err(|e| format!("wiki_links_get_recently_edited prepare failed: {e}"))?;
    let rows = stmt
        .query_map(params![cutoff_timestamp, limit], |row| {
            Ok(IndexItem {
                note_id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                is_pinned: row.get::<_, i64>(3)? != 0,
                updated_at: row.get(4)?,
                note_type: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|e| format!("wiki_links_get_recently_edited query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("wiki_links_get_recently_edited row failed: {e}"))?);
    }
    Ok(result)
}

// ─── Cluster Suggestions ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterRow {
    pub id: String,
    pub name: String,
    pub confidence: f64,
    pub created_at: i64,
    pub dismissed_at: Option<i64>,
    pub accepted_at: Option<i64>,
    pub accepted_note_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterMemberRow {
    pub cluster_id: String,
    pub note_id: String,
    pub score: f64,
}

pub fn clusters_get_active(index_db_path: &Path) -> Result<Vec<ClusterRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, confidence, created_at, dismissed_at, accepted_at, accepted_note_id
             FROM clusters
             WHERE dismissed_at IS NULL AND accepted_at IS NULL
             ORDER BY confidence DESC",
        )
        .map_err(|e| format!("clusters_get_active prepare failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ClusterRow {
                id: row.get(0)?,
                name: row.get(1)?,
                confidence: row.get(2)?,
                created_at: row.get(3)?,
                dismissed_at: row.get(4)?,
                accepted_at: row.get(5)?,
                accepted_note_id: row.get(6)?,
            })
        })
        .map_err(|e| format!("clusters_get_active query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_active row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_get_members(
    index_db_path: &Path,
    cluster_id: String,
) -> Result<Vec<ClusterMemberRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT cluster_id, note_id, score FROM cluster_members WHERE cluster_id = ?",
        )
        .map_err(|e| format!("clusters_get_members prepare failed: {e}"))?;
    let rows = stmt
        .query_map([&cluster_id], |row| {
            Ok(ClusterMemberRow {
                cluster_id: row.get(0)?,
                note_id: row.get(1)?,
                score: row.get(2)?,
            })
        })
        .map_err(|e| format!("clusters_get_members query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_members row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_dismiss(index_db_path: &Path, cluster_id: String) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "UPDATE clusters SET dismissed_at = ?1 WHERE id = ?2",
        rusqlite::params![
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64,
            cluster_id
        ],
    )
    .map_err(|e| format!("clusters_dismiss failed: {e}"))?;
    Ok(())
}

pub fn clusters_accept(
    index_db_path: &Path,
    cluster_id: String,
    note_id: Option<String>,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    conn.execute(
        "UPDATE clusters SET accepted_at = ?1, accepted_note_id = ?2 WHERE id = ?3",
        rusqlite::params![now, note_id, cluster_id],
    )
    .map_err(|e| format!("clusters_accept failed: {e}"))?;
    Ok(())
}

pub fn clusters_get_accepted(index_db_path: &Path) -> Result<Vec<ClusterRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, confidence, created_at, dismissed_at, accepted_at, accepted_note_id
             FROM clusters
             WHERE accepted_at IS NOT NULL AND dismissed_at IS NULL
             ORDER BY accepted_at ASC",
        )
        .map_err(|e| format!("clusters_get_accepted prepare failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ClusterRow {
                id: row.get(0)?,
                name: row.get(1)?,
                confidence: row.get(2)?,
                created_at: row.get(3)?,
                dismissed_at: row.get(4)?,
                accepted_at: row.get(5)?,
                accepted_note_id: row.get(6)?,
            })
        })
        .map_err(|e| format!("clusters_get_accepted query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_accepted row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_rename(
    index_db_path: &Path,
    cluster_id: String,
    name: String,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "UPDATE clusters SET name = ?1 WHERE id = ?2",
        rusqlite::params![name, cluster_id],
    )
    .map_err(|e| format!("clusters_rename failed: {e}"))?;
    Ok(())
}

pub fn clusters_import_from_json(
    index_db_path: &Path,
    notes_root: &Path,
) -> Result<usize, String> {
    use std::fs;
    let json_path = notes_root.join(".moc_clusters.json");
    if !json_path.exists() {
        return Ok(0);
    }
    let raw = fs::read_to_string(&json_path)
        .map_err(|e| format!("clusters_import_from_json read failed: {e}"))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("clusters JSON parse failed: {e}"))?;
    let clusters = parsed["clusters"]
        .as_array()
        .ok_or("clusters field missing or not array")?;

    let conn = open_index_db(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute(
        "DELETE FROM clusters WHERE dismissed_at IS NULL AND accepted_at IS NULL",
        [],
    )
    .map_err(|e| format!("clusters_import delete pending failed: {e}"))?;

    for cluster in clusters {
        let id = cluster["id"].as_str().ok_or("cluster missing id")?;
        let name = cluster["name"].as_str().ok_or("cluster missing name")?;
        let confidence = cluster["confidence"].as_f64().unwrap_or(0.0);
        conn.execute(
            "INSERT INTO clusters (id, name, confidence, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET name = CASE WHEN clusters.accepted_at IS NOT NULL THEN clusters.name ELSE excluded.name END, confidence = excluded.confidence",
            rusqlite::params![id, name, confidence, now],
        )
        .map_err(|e| format!("clusters_import insert failed: {e}"))?;

        if let Some(members) = cluster["members"].as_array() {
            for member in members {
                let note_id = member["note_id"].as_str().ok_or("member missing note_id")?;
                let score = member["score"].as_f64().unwrap_or(0.0);
                conn.execute(
                    "INSERT OR REPLACE INTO cluster_members (cluster_id, note_id, score) VALUES (?1, ?2, ?3)",
                    rusqlite::params![id, note_id, score],
                )
                .map_err(|e| format!("clusters_import member insert failed: {e}"))?;
            }
        }
    }
    Ok(clusters.len())
}

pub fn clusters_add_note(
    index_db_path: &Path,
    cluster_id: String,
    note_id: String,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "INSERT OR IGNORE INTO cluster_members (cluster_id, note_id, score) VALUES (?1, ?2, ?3)",
        rusqlite::params![cluster_id, note_id, 0.0],
    )
    .map_err(|e| format!("clusters_add_note failed: {e}"))?;
    Ok(())
}

pub fn clusters_remove_note(
    index_db_path: &Path,
    cluster_id: String,
    note_id: String,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "DELETE FROM cluster_members WHERE cluster_id = ?1 AND note_id = ?2",
        rusqlite::params![cluster_id, note_id],
    )
    .map_err(|e| format!("clusters_remove_note failed: {e}"))?;
    Ok(())
}

pub fn clusters_delete(index_db_path: &Path, cluster_id: String) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "DELETE FROM clusters WHERE id = ?1",
        rusqlite::params![cluster_id],
    )
    .map_err(|e| format!("clusters_delete failed: {e}"))?;
    Ok(())
}

// ─── Cluster Feedback ────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterFeedbackRow {
    pub cluster_id: String,
    pub event_type: String,
    pub event_data: Option<serde_json::Value>,
    pub created_at: i64,
}

pub fn clusters_record_feedback(
    index_db_path: &Path,
    cluster_id: String,
    event_type: String,
    event_data: Option<String>,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    conn.execute(
        "INSERT INTO cluster_feedback (cluster_id, event_type, event_data, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![cluster_id, event_type, event_data, now],
    )
    .map_err(|e| format!("clusters_record_feedback failed: {e}"))?;
    Ok(())
}

pub fn clusters_get_all_feedback(
    index_db_path: &Path,
) -> Result<Vec<ClusterFeedbackRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT cluster_id, event_type, event_data, created_at
             FROM cluster_feedback ORDER BY created_at DESC",
        )
        .map_err(|e| format!("clusters_get_all_feedback prepare failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            let event_data_str: Option<String> = row.get(2)?;
            Ok(ClusterFeedbackRow {
                cluster_id: row.get(0)?,
                event_type: row.get(1)?,
                event_data: event_data_str
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("clusters_get_all_feedback query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_all_feedback row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_export_feedback_file(
    index_db_path: &Path,
    notes_root: &Path,
) -> Result<(), String> {
    let feedback = clusters_get_all_feedback(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let json = serde_json::json!({
        "version": 1,
        "exported_at": now,
        "events": feedback,
    });
    let json_str = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("clusters_export_feedback_file serialize failed: {e}"))?;
    fs::write(notes_root.join(".moc_feedback.json"), json_str)
        .map_err(|e| format!("clusters_export_feedback_file write failed: {e}"))?;
    Ok(())
}
