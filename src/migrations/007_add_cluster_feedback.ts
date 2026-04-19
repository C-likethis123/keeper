import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
	await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cluster_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            created_at INTEGER NOT NULL
        )
    `);
	await db.execAsync("PRAGMA user_version = 7");
}
