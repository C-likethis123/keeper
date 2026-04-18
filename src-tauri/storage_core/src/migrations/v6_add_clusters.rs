use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER,
            accepted_note_id TEXT
        );
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
            note_id TEXT NOT NULL,
            score REAL NOT NULL,
            PRIMARY KEY (cluster_id, note_id)
        );
        PRAGMA user_version = 6;",
    )
    .map_err(|e| format!("migration v6 failed: {e}"))?;
    Ok(())
}
