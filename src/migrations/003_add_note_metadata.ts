import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase) {
	await db.withTransactionAsync(async () => {
		await db.execAsync(`
			ALTER TABLE note_index
			ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note'
		`);
		await db.execAsync(`
			ALTER TABLE note_index
			ADD COLUMN status TEXT
		`);
		await db.execAsync("PRAGMA user_version = 3");
	});
}
