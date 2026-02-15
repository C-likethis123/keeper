import { Document } from './Document';
import { DocumentSelection } from './Selection';
import { Operation } from './operations/Operation';
import { BlockNode } from './BlockNode';
import { UpdateBlockContentOperation } from './operations/UpdateBlockContentOperation';
import { UpdateBlockTypeOperation } from './operations/UpdateBlockTypeOperation';
import { UpdateListLevelOperation } from './operations/UpdateListLevelOperation';
import { InsertBlockOperation } from './operations/InsertBlockOperation';
import { DeleteBlockOperation } from './operations/DeleteBlockOperation';
import { ReplaceBlocksOperation } from './operations/ReplaceBlocksOperation';

/// A transaction groups multiple operations together.
///
/// Transactions are applied atomically and can be undone as a single unit.
export interface Transaction {
  readonly operations: readonly Operation[];
  readonly selectionBefore?: DocumentSelection;
  readonly selectionAfter?: DocumentSelection;
  readonly timestamp: Date;
  readonly description?: string;
}

/// Creates an empty transaction
export function createEmptyTransaction(): Transaction {
  return {
    operations: [],
    timestamp: new Date(),
  };
}

/// Whether this transaction has any operations
export function isTransactionEmpty(transaction: Transaction): boolean {
  return transaction.operations.length === 0;
}

/// Whether this transaction has operations
export function isTransactionNotEmpty(transaction: Transaction): boolean {
  return transaction.operations.length > 0;
}

/// Applies all operations in the transaction to the document
export function applyTransaction(
  transaction: Transaction,
  document: Document,
): Document {
  let result = document;
  for (const operation of transaction.operations) {
    result = operation.apply(result);
  }
  return result;
}

/// Creates the inverse transaction for undo
export function createInverseTransaction(
  transaction: Transaction,
  document: Document,
): Transaction {
  // Apply operations and collect inverses in reverse order
  const inverses: Operation[] = [];
  let current = document;

  for (const operation of transaction.operations) {
    inverses.push(operation.inverse(current));
    current = operation.apply(current);
  }

  return {
    operations: inverses.reverse(),
    selectionBefore: transaction.selectionAfter,
    selectionAfter: transaction.selectionBefore,
    description: transaction.description
      ? `Undo: ${transaction.description}`
      : 'Undo',
    timestamp: new Date(),
  };
}

/// Builder for creating transactions fluently
export class TransactionBuilder {
  private operations: Operation[] = [];
  private selectionBefore?: DocumentSelection;
  private selectionAfter?: DocumentSelection;
  private description?: string;

  /// Sets the selection state before the transaction
  withSelectionBefore(selection: DocumentSelection): this {
    this.selectionBefore = selection;
    return this;
  }

  /// Sets the selection state after the transaction
  withSelectionAfter(selection: DocumentSelection): this {
    this.selectionAfter = selection;
    return this;
  }

  /// Sets a description for the transaction
  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /// Adds an operation to update block content
  updateContent(
    blockIndex: number,
    oldContent: string,
    newContent: string,
  ): this {
    this.operations.push(
      new UpdateBlockContentOperation(blockIndex, oldContent, newContent),
    );
    return this;
  }

  /// Adds an operation to update block type
  updateType(
    blockIndex: number,
    oldType: BlockNode['type'],
    newType: BlockNode['type'],
    oldLanguage?: string,
    newLanguage?: string,
  ): this {
    this.operations.push(
      new UpdateBlockTypeOperation(blockIndex, oldType, newType, oldLanguage, newLanguage),
    );
    return this;
  }

  /// Adds an operation to update the list level of a block
  updateListLevel(
    blockIndex: number,
    oldLevel: number,
    newLevel: number,
  ): this {
    this.operations.push(
      new UpdateListLevelOperation(blockIndex, oldLevel, newLevel),
    );
    return this;
  }

  /// Adds an operation to insert a block
  insertBlock(index: number, block: BlockNode): this {
    this.operations.push(new InsertBlockOperation(index, block));
    return this;
  }

  /// Adds an operation to delete a block
  deleteBlock(index: number, block: BlockNode): this {
    this.operations.push(new DeleteBlockOperation(index, block));
    return this;
  }

  /// Adds an operation to replace blocks
  replaceBlocks(
    start: number,
    end: number,
    oldBlocks: readonly BlockNode[],
    newBlocks: readonly BlockNode[],
  ): this {
    this.operations.push(
      new ReplaceBlocksOperation(start, end, oldBlocks, newBlocks),
    );
    return this;
  }

  /// Builds the transaction
  build(): Transaction {
    return {
      operations: Object.freeze([...this.operations]),
      selectionBefore: this.selectionBefore,
      selectionAfter: this.selectionAfter,
      description: this.description,
      timestamp: new Date(),
    };
  }
}

