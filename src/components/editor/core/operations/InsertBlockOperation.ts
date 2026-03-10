import type { BlockNode } from "../BlockNode";
import { type Document, insertBlock } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to insert a new block
export class InsertBlockOperation implements Operation {
	readonly type = OperationType.insertBlock;

	constructor(
		readonly blockIndex: number,
		readonly block: BlockNode,
	) {}

	apply(document: Document): Document {
		return insertBlock(document, this.blockIndex, this.block);
	}

	inverse(document: Document): Operation {
		// Lazy require to break circular dependency
		const { DeleteBlockOperation } = require("./DeleteBlockOperation");
		return new DeleteBlockOperation(this.blockIndex, this.block);
	}
}
