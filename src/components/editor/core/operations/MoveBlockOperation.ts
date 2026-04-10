import { type Document, moveBlock } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to move a block from one index to another
export class MoveBlockOperation implements Operation {
	readonly type = OperationType.moveBlock;

	constructor(
		readonly fromIndex: number,
		readonly toIndex: number,
	) {}

	apply(document: Document): Document {
		return moveBlock(document, this.fromIndex, this.toIndex);
	}

	inverse(document: Document): Operation {
		// To reverse a move from A to B, we move from B to A.
		return new MoveBlockOperation(this.toIndex, this.fromIndex);
	}
}
