import type { SQLiteDatabase } from "expo-sqlite";

export const version = 1;

export async function migrate(db: SQLiteDatabase) {
	await db.withTransactionAsync(async () => {
		// Create FTS5 virtual table as a content table over note_index
		await db.execAsync(`
            CREATE VIRTUAL TABLE note_index_fts
            USING fts5(title, summary, content='note_index', content_rowid='rowid')
        `);

		// Populate FTS from existing rows
		await db.execAsync(`
            INSERT INTO note_index_fts(rowid, title, summary)
            SELECT rowid, title, summary FROM note_index
        `);

		// Triggers to keep FTS in sync with note_index
		await db.execAsync(`
            CREATE TRIGGER note_index_ai AFTER INSERT ON note_index BEGIN
                INSERT INTO note_index_fts(rowid, title, summary)
                VALUES (new.rowid, new.title, new.summary);
            END
        `);
		await db.execAsync(`
            CREATE TRIGGER note_index_ad AFTER DELETE ON note_index BEGIN
                INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
                VALUES ('delete', old.rowid, old.title, old.summary);
            END
        `);
		await db.execAsync(`
            CREATE TRIGGER note_index_au AFTER UPDATE ON note_index BEGIN
                INSERT INTO note_index_fts(note_index_fts, rowid, title, summary)
                VALUES ('delete', old.rowid, old.title, old.summary);
                INSERT INTO note_index_fts(rowid, title, summary)
                VALUES (new.rowid, new.title, new.summary);
            END
        `);

		await db.execAsync("PRAGMA user_version = 2");
	});
}
