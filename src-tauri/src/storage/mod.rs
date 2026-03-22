use std::path::PathBuf;
use tauri::Manager;

pub use storage_core::{
    IndexListInput, IndexListResult, IndexUpsertInput, NoteFileEntry, ReadNoteResult,
    ReadTemplateResult, RebuildMetrics, StorageInitResult, WriteNoteInput, WriteTemplateInput,
};

const NOTES_DIR: &str = "notes";
const TEMPLATES_DIR: &str = "templates";
const INDEX_DB_NAME: &str = "notes-index.db";

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

fn templates_root_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(notes_root_path(app)?.join(TEMPLATES_DIR))
}

#[tauri::command]
pub fn storage_initialize(app: tauri::AppHandle) -> Result<StorageInitResult, String> {
    let notes_root = notes_root_path(&app)?;
    let index_db = index_db_path(&app)?;
    storage_core::storage_initialize(&notes_root, &index_db)
}

#[tauri::command]
pub fn storage_reset_all_data(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    let notes_root = data_dir.join(NOTES_DIR);
    let index_db = data_dir.join(INDEX_DB_NAME);
    storage_core::reset_storage_dirs(&data_dir, &notes_root, &index_db)
}

#[tauri::command]
pub fn read_note(app: tauri::AppHandle, id: String) -> Result<Option<ReadNoteResult>, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::read_note(&notes_root, id)
}

#[tauri::command]
pub fn read_template(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<ReadTemplateResult>, String> {
    let templates_root = templates_root_path(&app)?;
    storage_core::read_template(&templates_root, id)
}

#[tauri::command]
pub fn write_note(app: tauri::AppHandle, input: WriteNoteInput) -> Result<i64, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::write_note(&notes_root, input)
}

#[tauri::command]
pub fn write_template(app: tauri::AppHandle, input: WriteTemplateInput) -> Result<i64, String> {
    let templates_root = templates_root_path(&app)?;
    storage_core::write_template(&templates_root, input)
}

#[tauri::command]
pub fn delete_note(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::delete_note(&notes_root, id)
}

#[tauri::command]
pub fn delete_template(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let templates_root = templates_root_path(&app)?;
    storage_core::delete_template(&templates_root, id)
}

#[tauri::command]
pub fn list_note_files(app: tauri::AppHandle) -> Result<Vec<NoteFileEntry>, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::list_note_files(&notes_root)
}

#[tauri::command]
pub fn list_templates(app: tauri::AppHandle) -> Result<Vec<ReadTemplateResult>, String> {
    let templates_root = templates_root_path(&app)?;
    storage_core::list_templates(&templates_root)
}

#[tauri::command]
pub fn stat_note(app: tauri::AppHandle, id: String) -> Result<Option<i64>, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::stat_note(&notes_root, id)
}

#[tauri::command]
pub fn index_upsert(app: tauri::AppHandle, input: IndexUpsertInput) -> Result<(), String> {
    let index_db = index_db_path(&app)?;
    storage_core::index_upsert(&index_db, input)
}

#[tauri::command]
pub fn index_delete(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    let index_db = index_db_path(&app)?;
    storage_core::index_delete(&index_db, note_id)
}

#[tauri::command]
pub fn index_list(app: tauri::AppHandle, input: IndexListInput) -> Result<IndexListResult, String> {
    let index_db = index_db_path(&app)?;
    storage_core::index_list(&index_db, input)
}

#[tauri::command]
pub fn index_rebuild_from_disk(app: tauri::AppHandle) -> Result<RebuildMetrics, String> {
    let notes_root = notes_root_path(&app)?;
    let index_db = index_db_path(&app)?;
    storage_core::index_rebuild_from_disk(&notes_root, &index_db)
}

#[tauri::command]
pub fn notes_root_path_command(app: tauri::AppHandle) -> Result<String, String> {
    let notes_root = notes_root_path(&app)?;
    storage_core::ensure_storage_dirs(
        notes_root
            .parent()
            .ok_or_else(|| "notes root is missing parent data dir".to_string())?,
    )?;
    Ok(notes_root.to_string_lossy().to_string())
}
