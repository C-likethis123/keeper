import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
	await db.execAsync(`
        CREATE TABLE IF NOT EXISTS super_clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER
        )
    `);
	await db.execAsync(
		"ALTER TABLE clusters ADD COLUMN parent_id TEXT",
	);
	await db.execAsync("PRAGMA user_version = 8");
}
