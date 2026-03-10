use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS note_index_fts
         USING fts5(title, summary, content='note_index', content_rowid='rowid');

         INSERT INTO note_index_fts(rowid, title, summary)
         SELECT rowid, title, summary FROM note_index;

         CREATE TRIGGER IF NOT EXISTS note_index_ai AFTER INSERT ON note_index BEGIN
           INSERT INTO note_index_fts(rowid, title, summary)
           VALUES (new.rowid, new.title, new.summary);
         END;
         CREATE TRIGGER IF NOT EXISTS note_index_ad AFTER DELETE ON note_index BEGIN
           INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
           VALUES ('delete', old.rowid, old.title, old.summary);
         END;
         CREATE TRIGGER IF NOT EXISTS note_index_au AFTER UPDATE ON note_index BEGIN
           INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
           VALUES ('delete', old.rowid, old.title, old.summary);
           INSERT INTO note_index_fts(rowid, title, summary)
           VALUES (new.rowid, new.title, new.summary);
         END;

         PRAGMA user_version = 2;",
    )
    .map_err(|e| format!("migration v2 failed: {e}"))?;

    Ok(())
}
