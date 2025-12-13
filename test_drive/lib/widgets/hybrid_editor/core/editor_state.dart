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

/// The central state manager for the editor.
/// 
/// EditorState is a ChangeNotifier that holds:
/// - The current document
/// - The current selection
/// - The focused block index
/// - Undo/redo history
/// 
/// All modifications go through transactions to enable undo/redo.
class EditorState extends ChangeNotifier {
  Document _document;
  DocumentSelection _selection;
  int? _focusedBlockIndex;
  final History _history;
  bool _isComposing = false;

  EditorState({
    Document? document,
    DocumentSelection? selection,
    HistoryConfig historyConfig = const HistoryConfig(),
  })  : _document = document ?? Document.empty(),
        _selection = selection ?? const DocumentSelection.start(),
        _history = History(config: historyConfig);

  /// The current document
  Document get document => _document;

  /// The current selection
  DocumentSelection get selection => _selection;

  /// The index of the currently focused block
  int? get focusedBlockIndex => _focusedBlockIndex;

  /// The currently focused block, if any
  BlockNode? get focusedBlock => 
      _focusedBlockIndex != null ? _document[_focusedBlockIndex!] : null;

  /// Whether there are changes to undo
  bool get canUndo => _history.canUndo;

  /// Whether there are changes to redo
  bool get canRedo => _history.canRedo;

  /// Whether the editor is currently in IME composition mode
  bool get isComposing => _isComposing;

  /// Sets the composing state (for IME input)
  set isComposing(bool value) {
    if (_isComposing != value) {
      _isComposing = value;
      notifyListeners();
    }
  }

  /// Sets the focused block index
  void setFocusedBlock(int? index) {
    if (_focusedBlockIndex != index) {
      _focusedBlockIndex = index;
      if (index != null) {
        // Update selection to be within the focused block
        _selection = DocumentSelection.collapsed(
          DocumentPosition(blockIndex: index, offset: _document[index].content.length),
        );
      }
      notifyListeners();
    }
  }

  /// Updates the selection
  void setSelection(DocumentSelection newSelection) {
    if (_selection != newSelection) {
      _selection = newSelection;
      notifyListeners();
    }
  }

  /// Applies a transaction to the document
  void apply(Transaction transaction) {
    if (transaction.isEmpty) return;

    // Store the inverse for undo
    _history.push(transaction, _document);

    // Apply the transaction
    _document = transaction.apply(_document);

    // Update selection if specified
    if (transaction.selectionAfter != null) {
      _selection = transaction.selectionAfter!;
    }

    notifyListeners();
  }

  /// Undoes the last transaction
  bool undo() {
    final inverse = _history.popUndo(_document);
    if (inverse == null) return false;

    _document = inverse.apply(_document);
    if (inverse.selectionAfter != null) {
      _selection = inverse.selectionAfter!;
    }

    notifyListeners();
    return true;
  }

  /// Redoes the last undone transaction
  bool redo() {
    final transaction = _history.popRedo(_document);
    if (transaction == null) return false;

    _document = transaction.apply(_document);
    if (transaction.selectionAfter != null) {
      _selection = transaction.selectionAfter!;
    }

    notifyListeners();
    return true;
  }

  // ============================================================
  // Convenience methods for common operations
  // ============================================================

  /// Updates the content of a block
  void updateBlockContent(int index, String newContent) {
    final block = _document[index];
    if (block.content == newContent) return;

    final transaction = TransactionBuilder()
        .updateContent(index, block.content, newContent)
        .withSelectionBefore(_selection)
        .withSelectionAfter(DocumentSelection.collapsed(
          DocumentPosition(blockIndex: index, offset: newContent.length),
        ))
        .withDescription('Update content')
        .build();

    apply(transaction);
  }

  /// Updates the type of a block
  void updateBlockType(int index, BlockType newType, {String? language}) {
    final block = _document[index];
    if (block.type == newType) return;

    final transaction = TransactionBuilder()
        .updateType(index, block.type, newType, language: language)
        .withSelectionBefore(_selection)
        .withSelectionAfter(_selection)
        .withDescription('Change block type')
        .build();

    apply(transaction);
  }

  /// Inserts a new block after the specified index
  void insertBlockAfter(int index, BlockNode block) {
    final transaction = TransactionBuilder()
        .insertBlock(index + 1, block)
        .withSelectionBefore(_selection)
        .withSelectionAfter(DocumentSelection.collapsed(
          DocumentPosition(blockIndex: index + 1, offset: 0),
        ))
        .withDescription('Insert block')
        .build();

    apply(transaction);
  }

  /// Deletes the block at the specified index
  void deleteBlock(int index) {
    if (_document.length <= 1) {
      // Don't delete the last block, just clear it
      updateBlockContent(index, '');
      return;
    }

    final block = _document[index];
    final newFocusIndex = index > 0 ? index - 1 : 0;
    final newFocusBlock = index > 0 ? _document[index - 1] : _document[1];

    final transaction = TransactionBuilder()
        .deleteBlock(index, block)
        .withSelectionBefore(_selection)
        .withSelectionAfter(DocumentSelection.collapsed(
          DocumentPosition(
            blockIndex: newFocusIndex,
            offset: newFocusBlock.content.length,
          ),
        ))
        .withDescription('Delete block')
        .build();

    apply(transaction);
    setFocusedBlock(newFocusIndex);
  }

  /// Splits the current block at the cursor position
  void splitBlock(int index, int offset) {
    final block = _document[index];
    final beforeContent = block.content.substring(0, offset);
    final afterContent = block.content.substring(offset);

    // Determine the type for the new block
    final newBlockType = block.isListItem ? block.type : BlockType.paragraph;

    final newBlock = BlockNode(
      id: BlockNode.generateId(),
      type: newBlockType,
      content: afterContent,
    );

    final transaction = TransactionBuilder()
        .updateContent(index, block.content, beforeContent)
        .insertBlock(index + 1, newBlock)
        .withSelectionBefore(_selection)
        .withSelectionAfter(DocumentSelection.collapsed(
          DocumentPosition(blockIndex: index + 1, offset: 0),
        ))
        .withDescription('Split block')
        .build();

    apply(transaction);
  }

  /// Merges the block at index with the previous block
  void mergeWithPrevious(int index) {
    if (index <= 0) return;

    final currentBlock = _document[index];
    final previousBlock = _document[index - 1];

    // Can't merge into a code block
    if (previousBlock.isCodeBlock) return;

    final mergedContent = previousBlock.content + currentBlock.content;
    final cursorOffset = previousBlock.content.length;

    final transaction = TransactionBuilder()
        .updateContent(index - 1, previousBlock.content, mergedContent)
        .deleteBlock(index, currentBlock)
        .withSelectionBefore(_selection)
        .withSelectionAfter(DocumentSelection.collapsed(
          DocumentPosition(blockIndex: index - 1, offset: cursorOffset),
        ))
        .withDescription('Merge blocks')
        .build();

    apply(transaction);
  }

  /// Replaces the entire document
  void replaceDocument(Document newDocument) {
    if (_document == newDocument) return;

    _document = newDocument;
    _selection = const DocumentSelection.start();
    _focusedBlockIndex = null;
    _history.clear();
    notifyListeners();
  }

  /// Loads content from markdown
  void loadMarkdown(String markdown) {
    replaceDocument(Document.fromMarkdown(markdown));
  }

  /// Gets the document as markdown
  String toMarkdown() => _document.toMarkdown();

  @override
  void dispose() {
    _history.clear();
    super.dispose();
  }
}

