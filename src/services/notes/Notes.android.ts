import { Paths } from "expo-file-system";

export let NOTES_ROOT = Paths.join(Paths.cache.uri, "notes");

export function setNotesRoot(path: string): void {
	NOTES_ROOT = path;
}

export function getTemplatesRoot(): string {
	return Paths.join(NOTES_ROOT, "templates");
}
