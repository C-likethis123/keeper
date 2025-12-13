/// Core module for the hybrid editor
/// 
/// Contains the fundamental data structures:
/// - [BlockNode]: Immutable block representation
/// - [Document]: Immutable document with block tree
/// - [DocumentPosition] and [DocumentSelection]: Selection model
/// - [Transaction] and [Operation]: State change system
library;

export 'block_node.dart';
export 'document.dart';
export 'selection.dart';
export 'transaction.dart';
export 'editor_state.dart';

