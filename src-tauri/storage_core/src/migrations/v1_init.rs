use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS note_index (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
        PRAGMA user_version = 1;",
    )
    .map_err(|e| format!("migration v1 failed: {e}"))?;

    Ok(())
}
