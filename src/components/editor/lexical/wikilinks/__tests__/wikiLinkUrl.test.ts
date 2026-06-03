import { WIKI_LINK } from "@/components/editor/lexical/wikilinks/WikiLinkMarkdownTransformer";
import {
	createWikiLinkUrl,
	parseWikiLinkUrl,
} from "@/components/editor/lexical/wikilinks/wikiLinkUrl";

describe("Lexical wikilinks", () => {
	it("round-trips titles through internal wikilink URLs", () => {
		const url = createWikiLinkUrl("Project Alpha");

		expect(url).toBe("keeper://wikilink/Project%20Alpha");
		expect(parseWikiLinkUrl(url)).toBe("Project Alpha");
	});

	it("ignores non-wikilink URLs", () => {
		expect(parseWikiLinkUrl("https://example.com")).toBeNull();
	});

	it("matches double-bracket markdown syntax", () => {
		const match = "See [[Project Alpha]]".match(WIKI_LINK.importRegExp ?? /$/);

		expect(match?.[1]).toBe("Project Alpha");
	});
});
