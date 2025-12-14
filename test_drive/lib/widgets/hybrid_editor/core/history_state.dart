import 'package:flutter/foundation.dart';
import 'block_node.dart';
import 'document.dart';
import 'selection.dart';
import 'transaction.dart';

/// Configuration for the history system
class HistoryConfig {
  final int maxUndoLevels;
  final Duration groupingDelay;

  const HistoryConfig({
    this.maxUndoLevels = 100,
    this.groupingDelay = const Duration(milliseconds: 500),
  });
}

/// Manages undo/redo history
class History {
  final List<Transaction> _undoStack = [];
  final List<Transaction> _redoStack = [];
  final HistoryConfig config;
  DateTime? _lastTransactionTime;

  History({this.config = const HistoryConfig()});

  /// Whether there are transactions to undo
  bool get canUndo => _undoStack.isNotEmpty;

  /// Whether there are transactions to redo
  bool get canRedo => _redoStack.isNotEmpty;

  /// Number of undo levels available
  int get undoDepth => _undoStack.length;

  /// Number of redo levels available
  int get redoDepth => _redoStack.length;

  /// Pushes a transaction to the undo stack
  void push(Transaction transaction, Document document) {
    if (transaction.isEmpty) return;

    // Clear redo stack on new changes
    _redoStack.clear();

    // Check if we should group with the previous transaction
    final now = DateTime.now();
    if (_lastTransactionTime != null &&
        _undoStack.isNotEmpty &&
        now.difference(_lastTransactionTime!) < config.groupingDelay) {
      // Group with previous transaction
      final previous = _undoStack.removeLast();
      final grouped = Transaction(
        operations: [...previous.operations, ...transaction.operations],
        selectionBefore: previous.selectionBefore,
        selectionAfter: transaction.selectionAfter,
        description: transaction.description ?? previous.description,
      );
      _undoStack.add(grouped);
    } else {
      _undoStack.add(transaction);
    }

    _lastTransactionTime = now;

    // Trim history if too long
    while (_undoStack.length > config.maxUndoLevels) {
      _undoStack.removeAt(0);
    }
  }

  /// Pops a transaction from the undo stack and returns it
  Transaction? popUndo(Document document) {
    if (!canUndo) return null;
    
    final transaction = _undoStack.removeLast();
    final inverse = transaction.inverse(document);
    _redoStack.add(transaction);
    _lastTransactionTime = null; // Break grouping
    
    return inverse;
  }

  /// Pops a transaction from the redo stack and returns it
  Transaction? popRedo(Document document) {
    if (!canRedo) return null;
    
    final transaction = _redoStack.removeLast();
    _undoStack.add(transaction);
    _lastTransactionTime = null;
    
    return transaction;
  }

  /// Clears all history
  void clear() {
    _undoStack.clear();
    _redoStack.clear();
    _lastTransactionTime = null;
  }
}