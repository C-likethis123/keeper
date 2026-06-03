import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { createEditor } from "lexical";
import { ImageNode } from "../ImageNode";
import { EquationNode } from "../equations/EquationNode";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../markdown";

function roundTripMarkdown(markdown: string): string {
	const editor = createEditor({
		namespace: "KeeperMarkdownTest",
		nodes: [
			HeadingNode,
			QuoteNode,
			ListNode,
			ListItemNode,
			CodeNode,
			CodeHighlightNode,
			LinkNode,
			AutoLinkNode,
			TableNode,
			TableCellNode,
			TableRowNode,
			EquationNode,
			ImageNode,
		],
		onError: (error) => {
			throw error;
		},
	});

	let result = "";
	editor.update(
		() => {
			importMarkdownToLexical(markdown);
			result = exportLexicalToMarkdown();
		},
		{ discrete: true },
	);

	return result;
}

describe("Keeper Lexical markdown transformers", () => {
	it("round-trips image markdown through ImageNode", () => {
		expect(roundTripMarkdown("![Diagram](keeper://asset/image.png)")).toBe(
			"![Diagram](keeper://asset/image.png)",
		);
	});

	it("round-trips block equation markdown through EquationNode", () => {
		expect(roundTripMarkdown("$$x = y + z$$")).toBe("$$x = y + z$$");
	});

	it("round-trips inline equation markdown through EquationNode", () => {
		expect(roundTripMarkdown("Inline $x = y + z$ equation")).toBe(
			"Inline $x = y + z$ equation",
		);
	});
});
