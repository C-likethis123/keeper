import type { BlockNode } from "../BlockNode";
import { type Document, replaceBlocks } from "../Document";
import { type Operation, OperationType } from "./Operation";

/// Operation to replace multiple blocks
export class ReplaceBlocksOperation implements Operation {
	readonly type = OperationType.replaceBlocks;

	constructor(
		readonly startIndex: number,
		readonly endIndex: number,
		readonly oldBlocks: readonly BlockNode[],
		readonly newBlocks: readonly BlockNode[],
	) {}

	apply(document: Document): Document {
		return replaceBlocks(document, this.startIndex, this.endIndex, [
			...this.newBlocks,
		]);
	}

	inverse(document: Document): Operation {
		return new ReplaceBlocksOperation(
			this.startIndex,
			this.startIndex + this.newBlocks.length,
			this.newBlocks,
			this.oldBlocks,
		);
	}
}
