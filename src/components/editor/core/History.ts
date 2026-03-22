import type { Document } from "./Document";
import {
	type Transaction,
	applyTransaction,
	createInverseTransaction,
	isTransactionEmpty,
} from "./Transaction";
import { UpdateBlockContentOperation } from "./operations/UpdateBlockContentOperation";

/// Configuration for the history system
interface HistoryConfig {
	readonly maxUndoLevels: number;
	readonly groupingDelay: number; // in milliseconds
}

const DEFAULT_CONFIG: HistoryConfig = {
	maxUndoLevels: 100,
	groupingDelay: 500,
};

/// Manages undo/redo history
export class History {
	private undoStack: Transaction[] = [];
	private redoStack: Transaction[] = [];
	private config: HistoryConfig;
	private lastTransactionTime?: Date;

	constructor(config: Partial<HistoryConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/// Whether there are transactions to undo
	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/// Whether there are transactions to redo
	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/// Number of undo levels available
	get undoDepth(): number {
		return this.undoStack.length;
	}

	/// Number of redo levels available
	get redoDepth(): number {
		return this.redoStack.length;
	}

	/// Pushes a transaction to the undo stack
	push(transaction: Transaction, document: Document): void {
		if (isTransactionEmpty(transaction)) {
			return;
		}

		// Clear redo stack on new changes
		this.redoStack = [];

		// Check if we should group with the previous transaction
		const now = new Date();
		if (
			this.lastTransactionTime &&
			this.undoStack.length > 0 &&
			now.getTime() - this.lastTransactionTime.getTime() <
				this.config.groupingDelay
		) {
			// Group with previous transaction
			const previous = this.undoStack.pop();
			if (!previous) return;
			const grouped = this.coalesceGroupedTransaction(
				previous,
				transaction,
				now,
			) ?? {
				operations: [...previous.operations, ...transaction.operations],
				selectionBefore: previous.selectionBefore,
				selectionAfter: transaction.selectionAfter,
				description: transaction.description ?? previous.description,
				timestamp: now,
			};
			this.undoStack.push(grouped);
		} else {
			this.undoStack.push(transaction);
		}

		this.lastTransactionTime = now;

		// Trim history if too long
		while (this.undoStack.length > this.config.maxUndoLevels) {
			this.undoStack.shift();
		}
	}

	/// Pops a transaction from the undo stack and returns its inverse
	popUndo(document: Document): Transaction | null {
		if (!this.canUndo) {
			return null;
		}

		const transaction = this.undoStack.pop();
		if (!transaction) return null;
		const inverse = createInverseTransaction(transaction, document);
		this.redoStack.push(transaction);
		this.lastTransactionTime = undefined; // Break grouping

		return inverse;
	}

	/// Pops a transaction from the redo stack and returns it
	popRedo(document: Document): Transaction | null {
		if (!this.canRedo) {
			return null;
		}

		const transaction = this.redoStack.pop();
		if (!transaction) return null;
		this.undoStack.push(transaction);
		this.lastTransactionTime = undefined;

		return transaction;
	}

	/// Clears all history
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.lastTransactionTime = undefined;
	}

	private coalesceGroupedTransaction(
		previous: Transaction,
		next: Transaction,
		timestamp: Date,
	): Transaction | null {
		if (previous.operations.length !== 1 || next.operations.length !== 1) {
			return null;
		}

		const previousOp = previous.operations[0];
		const nextOp = next.operations[0];
		if (
			!(previousOp instanceof UpdateBlockContentOperation) ||
			!(nextOp instanceof UpdateBlockContentOperation)
		) {
			return null;
		}

		if (
			previousOp.blockIndex !== nextOp.blockIndex ||
			previousOp.newContent !== nextOp.oldContent
		) {
			return null;
		}

		return {
			operations: [
				new UpdateBlockContentOperation(
					previousOp.blockIndex,
					previousOp.oldContent,
					nextOp.newContent,
				),
			],
			selectionBefore: previous.selectionBefore,
			selectionAfter: next.selectionAfter,
			description: next.description ?? previous.description,
			timestamp,
		};
	}
}
