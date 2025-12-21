import '../document.dart' show Document;

/// Types of operations that can be performed on the document
enum OperationType {
  insertText,
  deleteText,
  insertBlock,
  deleteBlock,
  updateBlock,
  replaceBlocks,
  setSelection,
  updateListLevel,
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