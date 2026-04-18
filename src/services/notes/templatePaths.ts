export function isIndexedNoteMarkdownPath(path: string): boolean {
	return path.endsWith(".md") && !path.includes("logseq/bak/");
}

export function getNoteIdFromMarkdownPath(path: string): string {
	return path.split("/").pop()?.replace(/\.md$/, "") ?? "";
}
