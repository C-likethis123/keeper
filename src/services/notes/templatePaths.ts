const TEMPLATES_DIR_PREFIX = "templates/";

export function getTemplateRelativePath(id: string): string {
	return `${TEMPLATES_DIR_PREFIX}${id}.md`;
}

export function isTemplateMarkdownPath(path: string): boolean {
	return path.startsWith(TEMPLATES_DIR_PREFIX) && path.endsWith(".md");
}

export function isIndexedNoteMarkdownPath(path: string): boolean {
	return path.endsWith(".md");
}

export function getNoteIdFromMarkdownPath(path: string): string {
	const normalizedPath = isTemplateMarkdownPath(path)
		? path.slice(TEMPLATES_DIR_PREFIX.length)
		: path;
	return normalizedPath.replace(/\.md$/, "");
}
