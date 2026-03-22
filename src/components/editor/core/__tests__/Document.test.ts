import { BlockType } from "../BlockNode";
import {
	createDocumentFromMarkdown,
	createEmptyDocument,
	documentToMarkdown,
	getListItemNumber,
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
});
