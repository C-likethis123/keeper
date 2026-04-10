import type { Document } from "../Document";

/// Types of operations that can be performed on the document
export enum OperationType {
	insertBlock = "insertBlock",
	deleteBlock = "deleteBlock",
	updateBlock = "updateBlock",
	updateBlockAttributes = "updateBlockAttributes",
	replaceBlocks = "replaceBlocks",
	moveBlock = "moveBlock",
}

/// Represents a single atomic operation on the document.
///
/// Operations are reversible, allowing for undo/redo functionality.
export interface Operation {
	readonly type: OperationType;

	/// Applies the operation to the document and returns the new document
	apply(document: Document): Document;

	/// Returns the inverse operation for undo
	inverse(document: Document): Operation;
}
