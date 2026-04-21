import { migrate as migrate001 } from "./001_init";
import { migrate as migrate002 } from "./002_add_fts";
import { migrate as migrate003 } from "./003_add_note_metadata";
import { migrate as migrate004 } from "./004_add_wiki_links";
import { migrate as migrate005 } from "./005_add_modified_column";
import { migrate as migrate006 } from "./006_add_clusters";
import { migrate as migrate007 } from "./007_add_cluster_feedback";
import { migrate as migrate008 } from "./008_add_super_clusters";

export const MIGRATIONS = [
	{ version: 1, migrate: migrate001 },
	{ version: 2, migrate: migrate002 },
	{ version: 3, migrate: migrate003 },
	{ version: 4, migrate: migrate004 },
	{ version: 5, migrate: migrate005 },
	{ version: 6, migrate: migrate006 },
	{ version: 7, migrate: migrate007 },
	{ version: 8, migrate: migrate008 },
];
