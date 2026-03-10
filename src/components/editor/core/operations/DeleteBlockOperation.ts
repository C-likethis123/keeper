import type { BlockNode } from "../BlockNode";
import { type Document, removeBlock } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to delete a block
export class DeleteBlockOperation implements Operation {
	readonly type = OperationType.deleteBlock;

	constructor(
		readonly blockIndex: number,
		readonly block: BlockNode,
	) {}

	apply(document: Document): Document {
		return removeBlock(document, this.blockIndex);
	}

	inverse(document: Document): Operation {
		// Lazy require to break circular dependency
		const { InsertBlockOperation } = require("./InsertBlockOperation");
		return new InsertBlockOperation(this.blockIndex, this.block);
	}
}
