/**
 * Parse `[[wikilink]]` patterns from note body content.
 *
 * Returns an array of raw wikilink titles (case-preserved, trimmed).
 * Strips `todo: ` prefix from `TODO: ` titles when matching, so that
 * `[[TODO: Buy milk]]` is stored as `TODO: Buy milk` (the canonical title).
 */
export function parseWikiLinksFromBody(content: string): string[] {
	const wikiLinkRegex = /\[\[(.+?)\]\]/g;
	const links: string[] = [];
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
	while ((match = wikiLinkRegex.exec(content)) !== null) {
		const raw = match[1].trim();
		if (raw.length > 0) {
			links.push(raw);
		}
	}

	return links;
}

/**
 * Compute a simple hash over note content for incremental sync.
 * Uses a fast string hash — good enough for detecting content changes.
 */
export function computeContentHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash.toString(36);
}
