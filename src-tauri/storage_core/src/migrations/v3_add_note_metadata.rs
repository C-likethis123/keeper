use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "ALTER TABLE note_index ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note';
         ALTER TABLE note_index ADD COLUMN status TEXT;
         PRAGMA user_version = 3;",
    )
    .map_err(|e| format!("migration v3 failed: {e}"))?;

    Ok(())
}
