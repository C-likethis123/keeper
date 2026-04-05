use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS wiki_links (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            PRIMARY KEY (source_id, target_id)
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_links_target ON wiki_links(target_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_links_source ON wiki_links(source_id);
        CREATE TABLE IF NOT EXISTS content_hashes (
            note_id TEXT PRIMARY KEY NOT NULL,
            content_hash TEXT NOT NULL
        );
        PRAGMA user_version = 4;",
    )
    .map_err(|e| format!("migration v4 failed: {e}"))?;

    Ok(())
}
