const WIKI_LINK_URL_PREFIX = "keeper://wikilink/";

export function createWikiLinkUrl(title: string): string {
	return `${WIKI_LINK_URL_PREFIX}${encodeURIComponent(title)}`;
}

export function parseWikiLinkUrl(url: string): string | null {
	if (!url.startsWith(WIKI_LINK_URL_PREFIX)) {
		return null;
	}

	const encodedTitle = url.slice(WIKI_LINK_URL_PREFIX.length);
	try {
		const title = decodeURIComponent(encodedTitle).trim();
		return title.length > 0 ? title : null;
	} catch {
		return null;
	}
}
