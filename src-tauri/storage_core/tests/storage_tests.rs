use rusqlite::{params, Connection};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use storage_core::{
    build_fts_match_query, delete_note, index_list, index_rebuild_from_disk, index_upsert,
    list_note_files, parse_frontmatter, read_note, serialize_note, storage_initialize,
    template_path_for_id, write_note, IndexListInput, IndexUpsertInput, WriteNoteInput,
    NOTES_DIR,
};

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
            NEXT_TEST_ID
                .fetch_add(1, Ordering::Relaxed)
                + SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("time went backwards")
                    .as_nanos() as u64,
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
