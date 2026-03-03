import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase) {
	await db.withTransactionAsync(async () => {
		await db.execAsync(`
    CREATE TABLE note_index (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);
		await db.execAsync("PRAGMA user_version = 1");
	});
}
