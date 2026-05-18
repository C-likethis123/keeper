import { BlockType } from "../BlockNode";
import { createEmptyDocument } from "../Document";
import { TransactionBuilder } from "../Transaction";
import { applyTransaction } from "../Transaction";

describe("Block Conversion Fix", () => {
	it("preserves attributes when converting a paragraph to a checkboxList", () => {
		const doc = createEmptyDocument();
		const index = 0;
		const block = doc.blocks[index];

		// This is the conversion logic used in useToolbarActions
		const transaction = new TransactionBuilder()
			.updateType(
				index,
				block.type,
				BlockType.checkboxList,
				undefined,
				undefined,
			)
			.build();

		const nextDoc = applyTransaction(transaction, doc);
		const nextBlock = nextDoc.blocks[index];

		expect(nextBlock.type).toBe(BlockType.checkboxList);
		expect(nextBlock.attributes).toBeDefined();
		expect(nextBlock.attributes!.checked).toBe(false);
	});

	it("preserves listLevel when converting from a bulletList to a checkboxList", () => {
		// Create a document with a bullet list at level 2
		const doc = createEmptyDocument();
		const initialDoc = new TransactionBuilder()
			.updateType(0, BlockType.paragraph, BlockType.bulletList)
			.updateBlockAttributes(0, {}, { listLevel: 2 })
			.build();
		const docWithList = applyTransaction(initialDoc, doc);

		const transaction = new TransactionBuilder()
			.updateType(0, BlockType.bulletList, BlockType.checkboxList)
			.build();

		const nextDoc = applyTransaction(transaction, docWithList);
		const nextBlock = nextDoc.blocks[0];

		expect(nextBlock.type).toBe(BlockType.checkboxList);
		expect(nextBlock.attributes!.listLevel).toBe(2);
		expect(nextBlock.attributes!.checked).toBe(false);
	});
});
