import { copyBlock } from "../BlockNode";
import { type Document, updateBlock } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to update block attributes (e.g. checkbox checked state)
export class UpdateBlockAttributesOperation implements Operation {
	readonly type = OperationType.updateBlockAttributes;

	constructor(
		readonly blockIndex: number,
		readonly oldAttributes: Record<string, unknown>,
		readonly newAttributes: Record<string, unknown>,
	) {}

	apply(document: Document): Document {
		const block = document.blocks[this.blockIndex];
		return updateBlock(
			document,
			this.blockIndex,
			copyBlock(block, { attributes: this.newAttributes }),
		);
	}

	inverse(document: Document): Operation {
		return new UpdateBlockAttributesOperation(
			this.blockIndex,
			this.newAttributes,
			this.oldAttributes,
		);
	}
}
