// Base file for TypeScript - Metro will use Notes.web.ts or Notes.android.ts at runtime
import { Paths } from "expo-file-system";

export let NOTES_ROOT = `${Paths.cache.uri}notes/`;

export function setNotesRoot(path: string): void {
	NOTES_ROOT = path;
}
