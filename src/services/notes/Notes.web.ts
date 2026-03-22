export let NOTES_ROOT = "web-notes://";

export function setNotesRoot(path: string): void {
	NOTES_ROOT = path;
}

export function getTemplatesRoot(): string {
	return `${NOTES_ROOT}templates/`;
}
