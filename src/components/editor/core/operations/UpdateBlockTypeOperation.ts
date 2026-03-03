import { BlockType, copyBlock } from "../BlockNode";
import { type Document, updateBlock } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to update the type of a block
export class UpdateBlockTypeOperation implements Operation {
	readonly type = OperationType.updateBlock;

	constructor(
		readonly blockIndex: number,
		readonly oldType: BlockType,
		readonly newType: BlockType,
		readonly oldLanguage?: string,
		readonly newLanguage?: string,
	) {}

	apply(document: Document): Document {
		const block = document.blocks[this.blockIndex];
		let attributes = { ...block.attributes };
		if (this.newType === BlockType.checkboxList) {
			attributes = { ...attributes, checked: !!block.attributes?.checked };
		}
		if (this.newLanguage !== undefined) {
			attributes = { ...attributes, language: this.newLanguage };
		}
		return updateBlock(
			document,
			this.blockIndex,
			copyBlock(block, { type: this.newType, attributes }),
		);
	}

	inverse(document: Document): Operation {
		return new UpdateBlockTypeOperation(
			this.blockIndex,
			this.newType,
			this.oldType,
			this.newLanguage,
			this.oldLanguage,
		);
	}
}
