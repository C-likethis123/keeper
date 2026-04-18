import { MIGRATIONS } from "@/migrations/migrations";
import type { SQLiteDatabase } from "expo-sqlite";
import * as SQLite from "expo-sqlite";

const DB_NAME = "notes-index.db";
const DATABASE_VERSION = 6;

let db: SQLite.SQLiteDatabase | null = null;

async function migrateDbIfNeeded(database: SQLiteDatabase): Promise<void> {
	const row = await database.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);
	let currentDbVersion = row?.user_version ?? 0;
	if (currentDbVersion >= DATABASE_VERSION) {
		return;
	}

	for (const migration of MIGRATIONS) {
		if (migration.version > currentDbVersion) {
			await migration.migrate(database);
			currentDbVersion = migration.version;
		}
	}
}

export async function getNotesIndexDb(): Promise<SQLite.SQLiteDatabase> {
	if (db) {
		return db;
	}

	db = await SQLite.openDatabaseAsync(DB_NAME);
	await db.execAsync("PRAGMA journal_mode = WAL");
	await migrateDbIfNeeded(db);
	return db;
}

export async function resetNotesIndexDb(): Promise<void> {
	if (db) {
		await db.closeAsync();
		db = null;
	}
	await SQLite.deleteDatabaseAsync(DB_NAME);
}
