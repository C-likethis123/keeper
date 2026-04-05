import { migrate as migrate001 } from "./001_init";
import { migrate as migrate002 } from "./002_add_fts";
import { migrate as migrate003 } from "./003_add_note_metadata";
import { migrate as migrate004 } from "./004_add_wiki_links";
import { migrate as migrate005 } from "./005_add_modified_column";

export const MIGRATIONS = [
	{ version: 1, migrate: migrate001 },
	{ version: 2, migrate: migrate002 },
	{ version: 3, migrate: migrate003 },
	{ version: 4, migrate: migrate004 },
	{ version: 5, migrate: migrate005 },
];
