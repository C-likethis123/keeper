import { BlockType, createCodeBlock, createParagraphBlock } from "../BlockNode";
import { createDocumentFromMarkdown, documentToMarkdown } from "../Document";
import {
	TransactionBuilder,
	applyTransaction,
	createInverseTransaction,
	isTransactionEmpty,
} from "../Transaction";

describe("Transaction", () => {
	it("applies multiple operations atomically", () => {
		const original = createDocumentFromMarkdown("Alpha");
		const inserted = createParagraphBlock("Beta");
		const transaction = new TransactionBuilder()
			.updateContent(0, "Alpha", "Alpha updated")
			.insertBlock(1, inserted)
			.build();

		const updated = applyTransaction(transaction, original);

		expect(updated.version).toBe(2);
		expect(updated.blocks.map((block) => block.content)).toEqual([
			"Alpha updated",
			"Beta",
		]);
	});

	it("creates an inverse transaction that restores the original document", () => {
		const original = createDocumentFromMarkdown("Alpha");
		const transaction = new TransactionBuilder()
			.updateContent(0, "Alpha", "Beta")
			.updateType(0, BlockType.paragraph, BlockType.codeBlock, undefined, "ts")
			.build();

		const updated = applyTransaction(transaction, original);
		const inverse = createInverseTransaction(transaction, original);
		const restored = applyTransaction(inverse, updated);

		expect(documentToMarkdown(updated)).toBe("```ts\nBeta\n```");
		expect(documentToMarkdown(restored)).toBe(documentToMarkdown(original));
		expect(restored.blocks[0].type).toBe(BlockType.paragraph);
		expect(restored.blocks[0].attributes).toEqual({ language: "ts" });
	});

	it("tracks transaction metadata from the builder", () => {
		const selection = {
			anchor: { blockIndex: 0, offset: 0 },
			focus: { blockIndex: 0, offset: 3 },
		};
		const transaction = new TransactionBuilder()
			.insertBlock(0, createCodeBlock("console.log('hi');", "ts"))
			.withSelectionBefore(selection)
			.withSelectionAfter(selection)
			.withDescription("Insert code block")
			.build();

		expect(isTransactionEmpty(transaction)).toBe(false);
		expect(transaction.selectionBefore).toEqual(selection);
		expect(transaction.selectionAfter).toEqual(selection);
		expect(transaction.description).toBe("Insert code block");
		expect(transaction.timestamp).toBeInstanceOf(Date);
	});

	it("treats a builder with no operations as an empty transaction", () => {
		const transaction = new TransactionBuilder().build();

		expect(isTransactionEmpty(transaction)).toBe(true);
	});

	it("applies a moveBlock operation and its inverse correctly", () => {
		const original = createDocumentFromMarkdown("A\nB\nC");
		const transaction = new TransactionBuilder()
			.moveBlock(0, 1)
			.withDescription("Move A below B")
			.build();

		const updated = applyTransaction(transaction, original);
		expect(documentToMarkdown(updated)).toBe("B\nA\nC");

		const inverse = createInverseTransaction(transaction, original);
		const restored = applyTransaction(inverse, updated);
		expect(documentToMarkdown(restored)).toBe("A\nB\nC");
		expect(inverse.description).toBe("Undo: Move A below B");
	});
});
