use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "ALTER TABLE note_index ADD COLUMN modified INTEGER;
         PRAGMA user_version = 5;",
    )
    .map_err(|e| format!("migration v5 failed: {e}"))?;

    Ok(())
}
