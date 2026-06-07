import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { CHECK_LIST, UNORDERED_LIST } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getRoot, createEditor } from "lexical";
import { ImageNode } from "../ImageNode";
import { EquationNode } from "../equations/EquationNode";
import {
	KEEPER_MARKDOWN_TRANSFORMERS,
	exportLexicalToMarkdown,
	importMarkdownToLexical,
} from "../markdown";
import { registerChecklistMarkdownPrefixTransform } from "../plugins/checklistMarkdownPrefix";
import { convertTodoTriggerAtSelection } from "../plugins/todoTriggerTransform";

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

	it("round-trips fenced code block language through CodeNode", () => {
		const markdown = "```cpp\nint main() {\n\treturn 0;\n}\n```";

		expect(roundTripMarkdown(markdown)).toBe(markdown);
	});

	it("round-trips unchecked checklist items", () => {
		expect(roundTripMarkdown("- [ ] Follow up")).toBe("- [ ] Follow up");
	});

	it("round-trips checked checklist items", () => {
		expect(roundTripMarkdown("- [x] Done")).toBe("- [x] Done");
	});

	it("checks checklist markdown before unordered list markdown", () => {
		const checklistIndex = KEEPER_MARKDOWN_TRANSFORMERS.findIndex(
			(transformer) => transformer === CHECK_LIST,
		);
		const unorderedListIndex = KEEPER_MARKDOWN_TRANSFORMERS.findIndex(
			(transformer) => transformer === UNORDERED_LIST,
		);

		expect(checklistIndex).toBeGreaterThanOrEqual(0);
		expect(checklistIndex).toBeLessThan(unorderedListIndex);
	});

	it("converts a bullet item prefix into a checklist item", () => {
		const editor = createEditor({
			namespace: "KeeperChecklistPrefixTest",
			nodes: [ListNode, ListItemNode],
			onError: (error) => {
				throw error;
			},
		});
		const unregister = registerChecklistMarkdownPrefixTransform(editor);

		let result = "";
		editor.update(
			() => {
				importMarkdownToLexical("- [x] test");
				result = exportLexicalToMarkdown();
			},
			{ discrete: true },
		);
		unregister();

		expect(result).toBe("- [x] test");
	});

	it("does not convert a TODO trigger while text is still being edited", () => {
		const editor = createEditor({
			namespace: "KeeperTodoTriggerIdleTest",
			nodes: [LinkNode],
			onError: (error) => {
				throw error;
			},
		});

		let result = "";
		editor.update(
			() => {
				importMarkdownToLexical("TODO: B");
				result = exportLexicalToMarkdown();
			},
			{ discrete: true },
		);

		expect(result).toBe("TODO: B");
	});

	it("converts a TODO trigger into a wiki link when leaving the paragraph", () => {
		const editor = createEditor({
			namespace: "KeeperTodoTriggerTest",
			nodes: [LinkNode],
			onError: (error) => {
				throw error;
			},
		});

		let result = "";
		editor.update(
			() => {
				importMarkdownToLexical("TODO: Buy milk");
				$getRoot().getFirstChild()?.selectEnd();
				convertTodoTriggerAtSelection();
				result = exportLexicalToMarkdown();
			},
			{ discrete: true },
		);

		expect(result).toBe("TODO: [[Buy milk]]");
	});

	it("preserves the accepted TODO trigger keyword and separator", () => {
		const editor = createEditor({
			namespace: "KeeperTodoTriggerNoColonTest",
			nodes: [LinkNode],
			onError: (error) => {
				throw error;
			},
		});

		let result = "";
		editor.update(
			() => {
				importMarkdownToLexical("todo Call Alice");
				$getRoot().getFirstChild()?.selectEnd();
				convertTodoTriggerAtSelection();
				result = exportLexicalToMarkdown();
			},
			{ discrete: true },
		);

		expect(result).toBe("todo [[Call Alice]]");
	});
});
