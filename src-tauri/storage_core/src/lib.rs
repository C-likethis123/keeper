mod migrations;

use gray_matter::{engine::YAML, Matter};
use rusqlite::{params, types::Value, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const TABLE: &str = "note_index";
const FTS_TABLE: &str = "note_index_fts";
const NOTES_DIR: &str = "notes";
const TEMPLATES_DIR: &str = "templates";

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EntryLocation {
    Note,
    Template,
}

fn notes_root(data_dir: &Path) -> PathBuf {
    data_dir.join(NOTES_DIR)
}

fn templates_root(notes_root: &Path) -> PathBuf {
    notes_root.join(TEMPLATES_DIR)
}

pub fn ensure_notes_dir(data_dir: &Path) -> Result<(), String> {
    let notes_root = notes_root(data_dir);
    fs::create_dir_all(data_dir).map_err(|e| format!("failed to create app data dir: {e}"))?;
    fs::create_dir_all(&notes_root).map_err(|e| format!("failed to create notes dir: {e}"))?;
    Ok(())
}

pub fn ensure_storage_dirs(data_dir: &Path) -> Result<(), String> {
    let notes_root = notes_root(data_dir);
    ensure_notes_dir(data_dir)?;
    fs::create_dir_all(templates_root(&notes_root))
        .map_err(|e| format!("failed to create templates dir: {e}"))?;
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

fn template_path_for_id(notes_root: &Path, id: &str) -> Result<PathBuf, String> {
    let clean_id = sanitize_note_id(id)?;
    Ok(templates_root(notes_root).join(format!("{clean_id}.md")))
}

fn path_for_note_type(notes_root: &Path, id: &str, note_type: &str) -> Result<PathBuf, String> {
    if note_type == "template" {
        template_path_for_id(notes_root, id)
    } else {
        path_for_id(notes_root, id)
    }
}

fn resolve_existing_entry_path(
    notes_root: &Path,
    id: &str,
) -> Result<Option<(EntryLocation, PathBuf)>, String> {
    let note_path = path_for_id(notes_root, id)?;
    let template_path = template_path_for_id(notes_root, id)?;
    let has_note = note_path.exists();
    let has_template = template_path.exists();

    match (has_note, has_template) {
        (false, false) => Ok(None),
        (true, false) => Ok(Some((EntryLocation::Note, note_path))),
        (false, true) => Ok(Some((EntryLocation::Template, template_path))),
        (true, true) => Err(format!(
            "duplicate note entries found for id '{id}' in notes and templates"
        )),
    }
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
}

fn parse_frontmatter(
    markdown: &str,
) -> (
    String,
    bool,
    String,
    Option<String>,
    Option<i64>,
    Option<i64>,
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
        "{delimiter}{pinned}\ntitle: {title}\nid: {id}{note_type}{status}{created_at}{completed_at}\n{close_delimiter}\n{content}",
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
        }
    ))
}

fn serialize_note(input: &WriteNoteInput) -> Result<String, String> {
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

fn build_fts_match_query(query: &str) -> Option<String> {
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
    let Some((location, path)) = resolve_existing_entry_path(notes_root, &id)? else {
        return Ok(None);
    };
    let markdown = fs::read_to_string(&path).map_err(|e| format!("failed to read note: {e}"))?;
    let (title, is_pinned, note_type, status, created_at, completed_at, content) =
        parse_frontmatter(&markdown);
    Ok(Some(ReadNoteResult {
        id,
        title,
        content,
        is_pinned: if location == EntryLocation::Template {
            false
        } else {
            is_pinned
        },
        last_updated: file_mtime_ms(&path),
        note_type: if location == EntryLocation::Template {
            "template".to_string()
        } else {
            note_type.clone()
        },
        status: if location == EntryLocation::Template && note_type != "todo" {
            None
        } else {
            status
        },
        created_at: if location == EntryLocation::Template && note_type != "todo" {
            None
        } else {
            created_at
        },
        completed_at: if location == EntryLocation::Template && note_type != "todo" {
            None
        } else {
            completed_at
        },
    }))
}

pub fn write_note(notes_root: &Path, input: WriteNoteInput) -> Result<i64, String> {
    let data_dir = notes_root
        .parent()
        .ok_or_else(|| "notes root is missing parent data dir".to_string())?;
    ensure_storage_dirs(data_dir)?;
    let path = path_for_note_type(notes_root, &input.id, &input.note_type)?;
    let markdown = serialize_note(&input)?;
    fs::write(&path, markdown).map_err(|e| format!("failed to write note: {e}"))?;
    Ok(file_mtime_ms(&path))
}

pub fn delete_note(notes_root: &Path, id: String) -> Result<bool, String> {
    let Some((_, path)) = resolve_existing_entry_path(notes_root, &id)? else {
        return Ok(false);
    };
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
    let template_entries = fs::read_dir(templates_root(notes_root))
        .map_err(|e| format!("failed to list templates dir: {e}"))?;
    for entry_result in template_entries {
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
            input.note_id,
            input.title,
            input.summary,
            if input.is_pinned { 1 } else { 0 },
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

    let mut where_clauses: Vec<&str> = Vec::new();
    let mut params_vec: Vec<Value> = Vec::new();

    if let Some(fts_match_query) = fts_match_query.as_ref() {
        where_clauses.push("note_index_fts MATCH ?");
        params_vec.push(Value::Text(fts_match_query.clone()));
    }
    if let Some(note_type) = filters
        .as_ref()
        .and_then(|value| value.note_type.as_ref())
    {
        where_clauses.push("note_index.note_type = ?");
        params_vec.push(Value::Text(note_type.clone()));
    }
    if let Some(status) = filters.as_ref().and_then(|value| value.status.as_ref()) {
        where_clauses.push("note_index.status = ?");
        params_vec.push(Value::Text(status.clone()));
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
        let (title, is_pinned, note_type, status, _, _, content) =
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

    let template_entries = fs::read_dir(templates_root(notes_root))
        .map_err(|e| format!("failed to list templates dir: {e}"))?;
    for entry_result in template_entries {
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
        let (title, _, embedded_type, status, _, _, content) =
            parse_frontmatter(&markdown);
        let summary = extract_summary(&content, 6);
        let status = if embedded_type == "todo" {
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
            params![id, title, summary, 0, file_mtime_ms(&path), "template", status],
        )
        .map_err(|e| format!("failed to insert template index row: {e}"))?;
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

#[cfg(test)]
mod tests {
    use super::{
        build_fts_match_query, delete_note, index_list, index_rebuild_from_disk, index_upsert,
        list_note_files, parse_frontmatter, read_note, serialize_note, storage_initialize,
        template_path_for_id, write_note, IndexListInput, IndexUpsertInput, WriteNoteInput,
        NOTES_DIR,
    };
    use rusqlite::{params, Connection};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static NEXT_TEST_ID: AtomicU64 = AtomicU64::new(0);

    struct TestStoragePaths {
        root: PathBuf,
        notes_root: PathBuf,
        index_db_path: PathBuf,
    }

    impl TestStoragePaths {
        fn new() -> Self {
            let unique = format!(
                "keeper-storage-core-{}-{}",
                std::process::id(),
                NEXT_TEST_ID.fetch_add(1, Ordering::Relaxed)
                    + SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .expect("time went backwards")
                        .as_nanos() as u64
            );
            let root = std::env::temp_dir().join(unique);
            let notes_root = root.join(NOTES_DIR);
            let index_db_path = root.join("notes-index.db");
            fs::create_dir_all(&root).expect("create temp root");
            Self {
                root,
                notes_root,
                index_db_path,
            }
        }
    }

    impl Drop for TestStoragePaths {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn write_markdown(path: &Path, markdown: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(path, markdown).expect("write markdown");
    }

    #[test]
    fn parse_frontmatter_unescapes_quoted_titles() {
        let markdown = "---\ntitle: \"He said \\\"hi\\\"\"\npinned: true\n---\nHello";
        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(markdown);

        assert_eq!(title, "He said \"hi\"");
        assert!(is_pinned);
        assert_eq!(note_type, "note");
        assert_eq!(status, None);
        assert_eq!(created_at, None);
        assert_eq!(completed_at, None);
        assert_eq!(content, "Hello");
    }

    #[test]
    fn parse_frontmatter_falls_back_for_plain_markdown() {
        let markdown = "# Heading\n\nBody";
        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(markdown);

        assert_eq!(title, "");
        assert!(!is_pinned);
        assert_eq!(note_type, "note");
        assert_eq!(status, None);
        assert_eq!(created_at, None);
        assert_eq!(completed_at, None);
        assert_eq!(content, markdown);
    }

    #[test]
    fn parse_frontmatter_falls_back_for_invalid_yaml() {
        let markdown = "---\ntitle: \"unterminated\n---\nBody";
        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(markdown);

        assert_eq!(title, "");
        assert!(!is_pinned);
        assert_eq!(note_type, "note");
        assert_eq!(status, None);
        assert_eq!(created_at, None);
        assert_eq!(completed_at, None);
        assert_eq!(content, markdown);
    }

    #[test]
    fn serialize_note_writes_frontmatter_and_body() {
        let markdown = serialize_note(&WriteNoteInput {
            id: "note-1".to_string(),
            title: "He said \"hi\"".to_string(),
            content: "# Heading\n- item".to_string(),
            is_pinned: true,
            note_type: "todo".to_string(),
            status: Some("open".to_string()),
            created_at: Some(1710000000000),
            completed_at: Some(1710003600000),
        })
        .expect("note should serialize");

        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(&markdown);
        assert_eq!(title, "He said \"hi\"");
        assert!(is_pinned);
        assert_eq!(note_type, "todo");
        assert_eq!(status.as_deref(), Some("open"));
        assert_eq!(created_at, Some(1710000000000));
        assert_eq!(completed_at, Some(1710003600000));
        assert_eq!(content, "# Heading\n- item");
        assert!(markdown.contains("\nid: \"note-1\"\n"));
    }

    #[test]
    fn parse_frontmatter_reads_template_metadata() {
        let markdown = "---\ntitle: \"Meeting\"\nid: \"template-1\"\ntype: \"todo\"\nstatus: \"doing\"\n---\n- agenda";
        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(markdown);

        assert_eq!(title, "Meeting");
        assert!(!is_pinned);
        assert_eq!(note_type, "todo");
        assert_eq!(status.as_deref(), Some("doing"));
        assert_eq!(created_at, None);
        assert_eq!(completed_at, None);
        assert_eq!(content, "- agenda");
    }

    #[test]
    fn serialize_note_omits_pinned_for_templates() {
        let markdown = serialize_note(&WriteNoteInput {
            id: "template-1".to_string(),
            title: "Checklist".to_string(),
            content: "- [ ] item".to_string(),
            is_pinned: true,
            note_type: "template".to_string(),
            status: Some("open".to_string()),
            created_at: None,
            completed_at: None,
        })
        .expect("template should serialize");

        let (title, is_pinned, note_type, status, created_at, completed_at, content) =
            parse_frontmatter(&markdown);
        assert_eq!(title, "Checklist");
        assert!(!is_pinned);
        assert_eq!(note_type, "template");
        assert_eq!(status, None);
        assert_eq!(created_at, None);
        assert_eq!(completed_at, None);
        assert_eq!(content, "- [ ] item");
        assert!(markdown.contains("\nid: \"template-1\"\n"));
        assert!(!markdown.contains("\npinned:"));
    }

    #[test]
    fn write_note_routes_templates_into_templates_directory() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");

        write_note(
            &paths.notes_root,
            WriteNoteInput {
                id: "template-1".to_string(),
                title: "Checklist".to_string(),
                content: "- [ ] item".to_string(),
                is_pinned: true,
                note_type: "template".to_string(),
                status: None,
                created_at: None,
                completed_at: None,
            },
        )
        .expect("write template");

        assert!(template_path_for_id(&paths.notes_root, "template-1")
            .expect("template path")
            .exists());
        assert!(!paths.notes_root.join("template-1.md").exists());
    }

    #[test]
    fn write_note_routes_regular_notes_into_notes_directory() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");

        write_note(
            &paths.notes_root,
            WriteNoteInput {
                id: "note-1".to_string(),
                title: "Note".to_string(),
                content: "body".to_string(),
                is_pinned: true,
                note_type: "note".to_string(),
                status: None,
                created_at: None,
                completed_at: None,
            },
        )
        .expect("write note");

        assert!(paths.notes_root.join("note-1.md").exists());
    }

    #[test]
    fn read_note_reads_template_entry_through_unified_api() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");
        write_markdown(
            &template_path_for_id(&paths.notes_root, "template-1").expect("template path"),
            "---\ntitle: \"Checklist\"\nid: \"template-1\"\ntype: \"todo\"\nstatus: \"doing\"\n---\n- agenda",
        );

        let note = read_note(&paths.notes_root, "template-1".to_string())
            .expect("read template")
            .expect("template exists");

        assert_eq!(note.note_type, "template");
        assert!(!note.is_pinned);
        assert_eq!(note.status.as_deref(), Some("doing"));
    }

    #[test]
    fn read_note_errors_when_duplicate_note_and_template_exist() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");
        write_markdown(&paths.notes_root.join("shared.md"), "---\ntitle: \"Note\"\n---\nbody");
        write_markdown(
            &template_path_for_id(&paths.notes_root, "shared").expect("template path"),
            "---\ntitle: \"Template\"\n---\nbody",
        );

        let err = read_note(&paths.notes_root, "shared".to_string()).expect_err("duplicate error");
        assert!(err.contains("duplicate note entries found"));
    }

    #[test]
    fn delete_note_errors_when_duplicate_note_and_template_exist() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");
        write_markdown(&paths.notes_root.join("shared.md"), "---\ntitle: \"Note\"\n---\nbody");
        write_markdown(
            &template_path_for_id(&paths.notes_root, "shared").expect("template path"),
            "---\ntitle: \"Template\"\n---\nbody",
        );

        let err =
            delete_note(&paths.notes_root, "shared".to_string()).expect_err("duplicate error");
        assert!(err.contains("duplicate note entries found"));
    }

    #[test]
    fn list_note_files_includes_templates() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");
        write_markdown(&paths.notes_root.join("note-1.md"), "---\ntitle: \"Note\"\n---\nbody");
        write_markdown(
            &template_path_for_id(&paths.notes_root, "template-1").expect("template path"),
            "---\ntitle: \"Template\"\n---\nbody",
        );

        let items = list_note_files(&paths.notes_root).expect("list note files");
        let ids: Vec<String> = items.into_iter().map(|item| item.id).collect();
        assert!(ids.contains(&"note-1".to_string()));
        assert!(ids.contains(&"template-1".to_string()));
    }

    #[test]
    fn index_rebuild_from_disk_indexes_templates() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");
        write_markdown(
            &template_path_for_id(&paths.notes_root, "template-1").expect("template path"),
            "---\ntitle: \"Template\"\nid: \"template-1\"\ntype: \"todo\"\nstatus: \"open\"\n---\n- agenda",
        );

        let metrics =
            index_rebuild_from_disk(&paths.notes_root, &paths.index_db_path).expect("rebuild");
        assert_eq!(metrics.note_count, 1);

        let conn = Connection::open(&paths.index_db_path).expect("open sqlite");
        let row = conn
            .query_row(
                "SELECT note_type, is_pinned, status FROM note_index WHERE id = ?1",
                params!["template-1"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .expect("read indexed row");
        assert_eq!(row.0, "template");
        assert_eq!(row.1, 0);
        assert_eq!(row.2.as_deref(), Some("open"));
    }

    #[test]
    fn build_fts_match_query_ignores_punctuation() {
        assert_eq!(
            build_fts_match_query("TODO: Ship release"),
            Some("TODO* Ship* release*".to_string())
        );
        assert_eq!(build_fts_match_query(" - "), None);
    }

    #[test]
    fn index_list_handles_todo_prefix_queries() {
        let paths = TestStoragePaths::new();
        storage_initialize(&paths.notes_root, &paths.index_db_path).expect("init storage");

        index_upsert(
            &paths.index_db_path,
            IndexUpsertInput {
                note_id: "todo-1".to_string(),
                title: "TODO: Ship release".to_string(),
                summary: "Wrap up the final checks".to_string(),
                is_pinned: false,
                updated_at: 1710000000000,
                note_type: "todo".to_string(),
                status: Some("open".to_string()),
            },
        )
        .expect("index todo");

        let result = index_list(
            &paths.index_db_path,
            IndexListInput {
                query: "TODO: Ship release".to_string(),
                limit: 20,
                offset: Some(0),
                filters: None,
            },
        )
        .expect("list notes");

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].note_id, "todo-1");
        assert_eq!(result.items[0].title, "TODO: Ship release");
    }
}
