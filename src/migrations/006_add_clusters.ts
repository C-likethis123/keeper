import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
	await db.execAsync(`
        CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER,
            accepted_note_id TEXT
        )
    `);
	await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
            note_id TEXT NOT NULL,
            score REAL NOT NULL,
            PRIMARY KEY (cluster_id, note_id)
        )
    `);
	await db.execAsync("PRAGMA user_version = 6");
}
