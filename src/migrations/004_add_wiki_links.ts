import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
	await db.execAsync(`
		CREATE TABLE IF NOT EXISTS wiki_links (
			source_id TEXT NOT NULL,
			target_id TEXT NOT NULL,
			PRIMARY KEY (source_id, target_id)
		)
	`);
	await db.execAsync(
		"CREATE INDEX IF NOT EXISTS idx_wiki_links_target ON wiki_links(target_id)",
	);
	await db.execAsync(
		"CREATE INDEX IF NOT EXISTS idx_wiki_links_source ON wiki_links(source_id)",
	);
	await db.execAsync(`
		CREATE TABLE IF NOT EXISTS content_hashes (
			note_id TEXT PRIMARY KEY NOT NULL,
			content_hash TEXT NOT NULL
		)
	`);
	await db.execAsync("PRAGMA user_version = 4");
}
