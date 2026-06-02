import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { createEditor } from "lexical";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../markdown";

function roundTripMarkdown(markdown: string): string {
	const editor = createEditor({
		namespace: "KeeperLexicalMarkdownTest",
		nodes: [
			HeadingNode,
			QuoteNode,
			ListNode,
			ListItemNode,
			CodeNode,
			CodeHighlightNode,
			LinkNode,
		],
		onError(error) {
			throw error;
		},
	});
	let exported = "";
	editor.update(
		() => {
			importMarkdownToLexical(markdown);
			exported = exportLexicalToMarkdown();
		},
		{ discrete: true },
	);
	return exported;
}

describe("Lexical markdown serialization", () => {
	it("round-trips common Keeper markdown blocks", () => {
		expect(
			roundTripMarkdown(`# Title

- First
- Second

1. Step one
2. Step two

\`\`\`ts
const value = 1;
\`\`\``),
		).toBe(`# Title

- First
- Second

1. Step one
2. Step two

\`\`\`ts
const value = 1;
\`\`\``);
	});
});
