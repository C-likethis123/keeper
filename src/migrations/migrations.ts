import { migrate as migrate001 } from "./001_init";
import { migrate as migrate002 } from "./002_add_fts";
import { migrate as migrate003 } from "./003_add_note_metadata";

export const MIGRATIONS = [
	{ version: 1, migrate: migrate001 },
	{ version: 2, migrate: migrate002 },
	{ version: 3, migrate: migrate003 },
];
