import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
	await db.execAsync("ALTER TABLE note_index ADD COLUMN modified INTEGER");
	await db.execAsync("PRAGMA user_version = 5");
}
