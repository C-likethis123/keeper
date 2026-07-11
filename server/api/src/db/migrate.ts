import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "migrations");
const pool = new Pool({ connectionString: databaseUrl });

await pool.query(`
	CREATE TABLE IF NOT EXISTS schema_migrations (
		name text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)
`);

const migrationFiles = (await fs.readdir(migrationsDir))
	.filter((file) => file.endsWith(".sql"))
	.sort();

for (const file of migrationFiles) {
	const existing = await pool.query(
		"SELECT name FROM schema_migrations WHERE name = $1",
		[file],
	);

	if (existing.rowCount) {
		continue;
	}

	const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
	await pool.query("BEGIN");
	try {
		await pool.query(sql);
		await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
		await pool.query("COMMIT");
		console.log(`applied ${file}`);
	} catch (error) {
		await pool.query("ROLLBACK");
		throw error;
	}
}

await pool.end();
