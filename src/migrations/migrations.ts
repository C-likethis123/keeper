import { migrate as migrate001 } from "./001_init";
import { migrate as migrate002 } from "./002_add_fts";

export const MIGRATIONS = [
	{ version: 1, migrate: migrate001 },
	{ version: 2, migrate: migrate002 },
];
