use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS super_clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER
        );
        ALTER TABLE clusters ADD COLUMN parent_id TEXT;
        PRAGMA user_version = 8;",
    )
    .map_err(|e| format!("migration v8 failed: {e}"))?;
    Ok(())
}
