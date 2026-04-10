import { BlockType } from "../BlockNode";
import {
	createDocumentFromMarkdown,
	createEmptyDocument,
	documentToMarkdown,
	getListItemNumber,
	moveBlock,
	removeBlock,
	replaceBlocks,
} from "../Document";

function summarizeDocument(markdown: string) {
	return createDocumentFromMarkdown(markdown).blocks.map((block) => ({
		type: block.type,
		content: block.content,
		attributes: block.attributes,
	}));
}

describe("Document", () => {
	it("creates an empty document with a single paragraph block", () => {
		const document = createEmptyDocument();

		expect(document.version).toBe(0);
		expect(document.blocks).toHaveLength(1);
		expect(document.blocks[0].type).toBe(BlockType.paragraph);
		expect(document.blocks[0].content).toBe("");
	});

	it("parses markdown into the expected block types", () => {
		const blocks = summarizeDocument(`# Title
Paragraph text

- bullet item
  1. nested number
- [x] finished task
![](ignored)
![video](ignored)
\`\`\`ts
const answer = 42;
\`\`\`

$$
x^2
$$
![](images/photo.png)`);

		expect(blocks).toEqual([
			{ type: BlockType.heading1, content: "Title", attributes: {} },
			{ type: BlockType.paragraph, content: "Paragraph text", attributes: {} },
			{ type: BlockType.paragraph, content: "", attributes: {} },
			{
				type: BlockType.bulletList,
				content: "bullet item",
				attributes: { listLevel: 0 },
			},
			{
				type: BlockType.numberedList,
				content: "nested number",
				attributes: { listLevel: 1 },
			},
			{
				type: BlockType.checkboxList,
				content: "finished task",
				attributes: { listLevel: 0, checked: true },
			},
			{
				type: BlockType.image,
				content: "ignored",
				attributes: {},
			},
			{
				type: BlockType.video,
				content: "ignored",
				attributes: {},
			},
			{
				type: BlockType.codeBlock,
				content: "const answer = 42;",
				attributes: { language: "ts" },
			},
			{ type: BlockType.paragraph, content: "", attributes: {} },
			{ type: BlockType.mathBlock, content: "x^2", attributes: {} },
			{ type: BlockType.image, content: "images/photo.png", attributes: {} },
		]);
	});

	it("serializes numbered lists and code blocks back to markdown", () => {
		const document = createDocumentFromMarkdown(`1. First
2. Second
  1. Nested
\`\`\`ts
const answer = 42;
\`\`\`
$$
x^2
$$`);

		expect(getListItemNumber(document, 0)).toBe(1);
		expect(getListItemNumber(document, 1)).toBe(2);
		expect(getListItemNumber(document, 2)).toBe(1);
		expect(documentToMarkdown(document)).toBe(`1. First
2. Second
  1. Nested
\`\`\`ts
const answer = 42;
\`\`\`

$$
x^2
$$`);
	});

	it("parses a collapsible block with summary and body content", () => {
		const blocks = summarizeDocument(
			`<details open>
<summary>My section</summary>

Body content here
More body content

</details>`,
		);
		expect(blocks).toEqual([
			{
				type: BlockType.collapsibleBlock,
				content: "Body content here\nMore body content",
				attributes: { summary: "My section", isExpanded: true },
			},
		]);
	});

	it("parses a collapsed collapsible block", () => {
		const blocks = summarizeDocument(
			`<details>
<summary>Collapsed section</summary>

Hidden body

</details>`,
		);
		expect(blocks).toEqual([
			{
				type: BlockType.collapsibleBlock,
				content: "Hidden body",
				attributes: { summary: "Collapsed section", isExpanded: false },
			},
		]);
	});

	it("parses a collapsible block with empty body", () => {
		const blocks = summarizeDocument(
			`<details>
<summary>Empty section</summary>

</details>`,
		);
		expect(blocks).toEqual([
			{
				type: BlockType.collapsibleBlock,
				content: "",
				attributes: { summary: "Empty section", isExpanded: false },
			},
		]);
	});

	it("serializes a collapsible block to <details> format", () => {
		const doc = createDocumentFromMarkdown(`<details open>
<summary>My section</summary>

Body here

</details>`);
		expect(documentToMarkdown(doc)).toBe(
			"<details open>\n<summary>My section</summary>\n\nBody here\n\n</details>",
		);
	});

	it("serializes a collapsed collapsible block without open attribute", () => {
		const doc = createDocumentFromMarkdown(`<details>
<summary>Hidden</summary>

Content

</details>`);
		expect(documentToMarkdown(doc)).toBe(
			"<details>\n<summary>Hidden</summary>\n\nContent\n\n</details>",
		);
	});

	it("round-trips a collapsible block through parse and serialize", () => {
		const markdown =
			"<details open>\n<summary>Round trip</summary>\n\nSome **bold** content\n\n</details>";
		const doc = createDocumentFromMarkdown(markdown);
		expect(documentToMarkdown(doc)).toBe(markdown);
	});

	it("adds extra blank line after collapsible block when followed by another block", () => {
		const doc = createDocumentFromMarkdown(`<details>
<summary>Section</summary>

Body

</details>
Next paragraph`);
		const md = documentToMarkdown(doc);
		expect(md).toContain("</details>\n\nNext paragraph");
	});

	it("keeps the document non-empty when removing or replacing every block", () => {
		const singleBlock = createDocumentFromMarkdown("Only block");
		const removed = removeBlock(singleBlock, 0);
		const replaced = replaceBlocks(singleBlock, 0, 1, []);

		expect(removed.blocks).toHaveLength(1);
		expect(removed.blocks[0].type).toBe(BlockType.paragraph);
		expect(removed.blocks[0].content).toBe("");

		expect(replaced.blocks).toHaveLength(1);
		expect(replaced.blocks[0].type).toBe(BlockType.paragraph);
		expect(replaced.blocks[0].content).toBe("");
	});

	describe("moveBlock", () => {
		it("moves a block down", () => {
			const doc = createDocumentFromMarkdown("A\nB\nC");
			const moved = moveBlock(doc, 0, 1);
			expect(documentToMarkdown(moved)).toBe("B\nA\nC");
		});

		it("moves a block up", () => {
			const doc = createDocumentFromMarkdown("A\nB\nC");
			const moved = moveBlock(doc, 2, 1);
			expect(documentToMarkdown(moved)).toBe("A\nC\nB");
		});

		it("moves a block to the same index", () => {
			const doc = createDocumentFromMarkdown("A\nB\nC");
			const moved = moveBlock(doc, 1, 1);
			expect(documentToMarkdown(moved)).toBe("A\nB\nC");
		});

		it("throws for out of bounds indexes", () => {
			const doc = createDocumentFromMarkdown("A\nB");
			expect(() => moveBlock(doc, -1, 1)).toThrow();
			expect(() => moveBlock(doc, 0, 2)).toThrow();
		});
	});
});
