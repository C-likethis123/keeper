import 'package:test_drive/widgets/hybrid_editor/core/transactions/modify_block_count_operation.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/operation.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/replace_block_operation.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/update_block_content_operation.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/update_block_type_operation.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/update_list_level_operation.dart';

import 'block_node.dart';
import 'document.dart';
import 'selection.dart';

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
  String toString() =>
      'Transaction(${operations.length} operations, ${description ?? "no description"})';
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
  TransactionBuilder updateContent(
    int blockIndex,
    String oldContent,
    String newContent,
  ) {
    _operations.add(
      UpdateBlockContentOperation(
        blockIndex: blockIndex,
        oldContent: oldContent,
        newContent: newContent,
      ),
    );
    return this;
  }

  /// Adds an operation to update block type
  TransactionBuilder updateType(
    int blockIndex,
    BlockType oldType,
    BlockType newType, {
    String? language,
  }) {
    _operations.add(
      UpdateBlockTypeOperation(
        blockIndex: blockIndex,
        oldType: oldType,
        newType: newType,
        newLanguage: language,
      ),
    );
    return this;
  }

  /// Adds an operation to update the list level of a block
  TransactionBuilder updateListLevel(
    int blockIndex,
    int oldLevel,
    int newLevel,
  ) {
    _operations.add(
      UpdateListLevelOperation(
        blockIndex: blockIndex,
        oldLevel: oldLevel,
        newLevel: newLevel,
      ),
    );
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
    _operations.add(
      ReplaceBlocksOperation(
        startIndex: start,
        endIndex: end,
        oldBlocks: oldBlocks,
        newBlocks: newBlocks,
      ),
    );
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
