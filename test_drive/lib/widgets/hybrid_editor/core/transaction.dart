import 'block_node.dart';
import 'document.dart';
import 'selection.dart';

/// Types of operations that can be performed on the document
enum OperationType {
  insertText,
  deleteText,
  insertBlock,
  deleteBlock,
  updateBlock,
  replaceBlocks,
  setSelection,
  composite, // Multiple operations grouped together
}

/// Represents a single atomic operation on the document.
/// 
/// Operations are reversible, allowing for undo/redo functionality.
abstract class Operation {
  OperationType get type;
  
  /// Applies the operation to the document and returns the new document
  Document apply(Document document);
  
  /// Returns the inverse operation for undo
  Operation inverse(Document document);
}

/// Operation to update the content of a block
class UpdateBlockContentOperation implements Operation {
  final int blockIndex;
  final String oldContent;
  final String newContent;

  const UpdateBlockContentOperation({
    required this.blockIndex,
    required this.oldContent,
    required this.newContent,
  });

  @override
  OperationType get type => OperationType.updateBlock;

  @override
  Document apply(Document document) {
    final block = document[blockIndex];
    return document.updateBlock(
      blockIndex,
      block.copyWith(content: newContent),
    );
  }

  @override
  Operation inverse(Document document) {
    return UpdateBlockContentOperation(
      blockIndex: blockIndex,
      oldContent: newContent,
      newContent: oldContent,
    );
  }
}

/// Operation to update the type of a block
class UpdateBlockTypeOperation implements Operation {
  final int blockIndex;
  final BlockType oldType;
  final BlockType newType;
  final String? oldLanguage;
  final String? newLanguage;

  const UpdateBlockTypeOperation({
    required this.blockIndex,
    required this.oldType,
    required this.newType,
    this.oldLanguage,
    this.newLanguage,
  });

  @override
  OperationType get type => OperationType.updateBlock;

  @override
  Document apply(Document document) {
    final block = document[blockIndex];
    return document.updateBlock(
      blockIndex,
      block.copyWith(type: newType, language: newLanguage),
    );
  }

  @override
  Operation inverse(Document document) {
    return UpdateBlockTypeOperation(
      blockIndex: blockIndex,
      oldType: newType,
      newType: oldType,
      oldLanguage: newLanguage,
      newLanguage: oldLanguage,
    );
  }
}

/// Operation to insert a new block
class InsertBlockOperation implements Operation {
  final int blockIndex;
  final BlockNode block;

  const InsertBlockOperation({
    required this.blockIndex,
    required this.block,
  });

  @override
  OperationType get type => OperationType.insertBlock;

  @override
  Document apply(Document document) {
    return document.insertBlock(blockIndex, block);
  }

  @override
  Operation inverse(Document document) {
    return DeleteBlockOperation(blockIndex: blockIndex, block: block);
  }
}

/// Operation to delete a block
class DeleteBlockOperation implements Operation {
  final int blockIndex;
  final BlockNode block;

  const DeleteBlockOperation({
    required this.blockIndex,
    required this.block,
  });

  @override
  OperationType get type => OperationType.deleteBlock;

  @override
  Document apply(Document document) {
    return document.removeBlock(blockIndex);
  }

  @override
  Operation inverse(Document document) {
    return InsertBlockOperation(blockIndex: blockIndex, block: block);
  }
}

/// Operation to replace multiple blocks
class ReplaceBlocksOperation implements Operation {
  final int startIndex;
  final int endIndex;
  final List<BlockNode> oldBlocks;
  final List<BlockNode> newBlocks;

  const ReplaceBlocksOperation({
    required this.startIndex,
    required this.endIndex,
    required this.oldBlocks,
    required this.newBlocks,
  });

  @override
  OperationType get type => OperationType.replaceBlocks;

  @override
  Document apply(Document document) {
    return document.replaceBlocks(startIndex, endIndex, newBlocks);
  }

  @override
  Operation inverse(Document document) {
    return ReplaceBlocksOperation(
      startIndex: startIndex,
      endIndex: startIndex + newBlocks.length,
      oldBlocks: newBlocks,
      newBlocks: oldBlocks,
    );
  }
}

/// A transaction groups multiple operations together.
/// 
/// Transactions are applied atomically and can be undone as a single unit.
class Transaction {
  final List<Operation> operations;
  final DocumentSelection? selectionBefore;
  final DocumentSelection? selectionAfter;
  final DateTime timestamp;
  final String? description;

  Transaction({
    required this.operations,
    this.selectionBefore,
    this.selectionAfter,
    DateTime? timestamp,
    this.description,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Creates an empty transaction
  factory Transaction.empty() {
    return Transaction(operations: const []);
  }

  /// Whether this transaction has any operations
  bool get isEmpty => operations.isEmpty;

  /// Whether this transaction has operations
  bool get isNotEmpty => operations.isNotEmpty;

  /// Applies all operations in the transaction to the document
  Document apply(Document document) {
    Document result = document;
    for (final operation in operations) {
      result = operation.apply(result);
    }
    return result;
  }

  /// Creates the inverse transaction for undo
  Transaction inverse(Document document) {
    // Apply operations and collect inverses in reverse order
    final inverses = <Operation>[];
    Document current = document;
    
    for (final operation in operations) {
      inverses.add(operation.inverse(current));
      current = operation.apply(current);
    }
    
    return Transaction(
      operations: inverses.reversed.toList(),
      selectionBefore: selectionAfter,
      selectionAfter: selectionBefore,
      description: description != null ? 'Undo: $description' : 'Undo',
    );
  }

  @override
  String toString() => 'Transaction(${operations.length} operations, ${description ?? "no description"})';
}

/// Builder for creating transactions fluently
class TransactionBuilder {
  final List<Operation> _operations = [];
  DocumentSelection? _selectionBefore;
  DocumentSelection? _selectionAfter;
  String? _description;

  /// Sets the selection state before the transaction
  TransactionBuilder withSelectionBefore(DocumentSelection selection) {
    _selectionBefore = selection;
    return this;
  }

  /// Sets the selection state after the transaction
  TransactionBuilder withSelectionAfter(DocumentSelection selection) {
    _selectionAfter = selection;
    return this;
  }

  /// Sets a description for the transaction
  TransactionBuilder withDescription(String description) {
    _description = description;
    return this;
  }

  /// Adds an operation to update block content
  TransactionBuilder updateContent(int blockIndex, String oldContent, String newContent) {
    _operations.add(UpdateBlockContentOperation(
      blockIndex: blockIndex,
      oldContent: oldContent,
      newContent: newContent,
    ));
    return this;
  }

  /// Adds an operation to update block type
  TransactionBuilder updateType(int blockIndex, BlockType oldType, BlockType newType, {String? language}) {
    _operations.add(UpdateBlockTypeOperation(
      blockIndex: blockIndex,
      oldType: oldType,
      newType: newType,
      newLanguage: language,
    ));
    return this;
  }

  /// Adds an operation to insert a block
  TransactionBuilder insertBlock(int index, BlockNode block) {
    _operations.add(InsertBlockOperation(blockIndex: index, block: block));
    return this;
  }

  /// Adds an operation to delete a block
  TransactionBuilder deleteBlock(int index, BlockNode block) {
    _operations.add(DeleteBlockOperation(blockIndex: index, block: block));
    return this;
  }

  /// Adds an operation to replace blocks
  TransactionBuilder replaceBlocks(
    int start,
    int end,
    List<BlockNode> oldBlocks,
    List<BlockNode> newBlocks,
  ) {
    _operations.add(ReplaceBlocksOperation(
      startIndex: start,
      endIndex: end,
      oldBlocks: oldBlocks,
      newBlocks: newBlocks,
    ));
    return this;
  }

  /// Builds the transaction
  Transaction build() {
    return Transaction(
      operations: List.unmodifiable(_operations),
      selectionBefore: _selectionBefore,
      selectionAfter: _selectionAfter,
      description: _description,
    );
  }
}

