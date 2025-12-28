import 'package:flutter/foundation.dart';

/// Represents a position within the document.
/// 
/// A position is defined by the block index and the character offset
/// within that block's content.
@immutable
class DocumentPosition implements Comparable<DocumentPosition> {
  final int blockIndex;
  final int offset;

  const DocumentPosition({
    required this.blockIndex,
    required this.offset,
  });

  /// Creates a position at the start of the document
  const DocumentPosition.start() : blockIndex = 0, offset = 0;

  /// Creates a copy with updated fields
  DocumentPosition copyWith({
    int? blockIndex,
    int? offset,
  }) {
    return DocumentPosition(
      blockIndex: blockIndex ?? this.blockIndex,
      offset: offset ?? this.offset,
    );
  }

  /// Whether this position is before another position
  bool isBefore(DocumentPosition other) => compareTo(other) < 0;

  /// Whether this position is after another position
  bool isAfter(DocumentPosition other) => compareTo(other) > 0;

  @override
  int compareTo(DocumentPosition other) {
    if (blockIndex != other.blockIndex) {
      return blockIndex.compareTo(other.blockIndex);
    }
    return offset.compareTo(other.offset);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DocumentPosition &&
          runtimeType == other.runtimeType &&
          blockIndex == other.blockIndex &&
          offset == other.offset;

  @override
  int get hashCode => Object.hash(blockIndex, offset);

  @override
  String toString() => 'DocumentPosition(block: $blockIndex, offset: $offset)';
}

/// Represents a selection in the document.
/// 
/// A selection has an anchor (where the selection started) and a focus
/// (where the selection currently ends). If anchor == focus, it's a
/// collapsed selection (cursor).
@immutable
class DocumentSelection {
  final DocumentPosition anchor;
  final DocumentPosition focus;

  const DocumentSelection({
    required this.anchor,
    required this.focus,
  });

  /// Creates a collapsed selection (cursor) at the given position
  const DocumentSelection.collapsed(DocumentPosition position)
      : anchor = position,
        focus = position;

  /// Creates a collapsed selection at the start of the document
  const DocumentSelection.start()
      : anchor = const DocumentPosition.start(),
        focus = const DocumentPosition.start();

  /// Whether this is a collapsed selection (cursor with no range)
  bool get isCollapsed => anchor == focus;

  /// Gets the start position (earlier of anchor/focus)
  DocumentPosition get start => anchor.isBefore(focus) ? anchor : focus;

  /// Gets the end position (later of anchor/focus)
  DocumentPosition get end => anchor.isAfter(focus) ? anchor : focus;

  /// Whether the selection is backwards (focus before anchor)
  bool get isBackward => focus.isBefore(anchor);

  /// Gets the block index where the selection starts
  int get startBlockIndex => start.blockIndex;

  /// Gets the block index where the selection ends
  int get endBlockIndex => end.blockIndex;

  /// Whether the selection spans multiple blocks
  bool get spansMultipleBlocks => startBlockIndex != endBlockIndex;

  /// Creates a copy with updated fields
  DocumentSelection copyWith({
    DocumentPosition? anchor,
    DocumentPosition? focus,
  }) {
    return DocumentSelection(
      anchor: anchor ?? this.anchor,
      focus: focus ?? this.focus,
    );
  }

  /// Creates a collapsed selection at the focus position
  DocumentSelection collapse({bool toStart = false}) {
    final position = toStart ? start : end;
    return DocumentSelection.collapsed(position);
  }

  /// Extends the selection to a new focus position
  DocumentSelection extendTo(DocumentPosition newFocus) {
    return copyWith(focus: newFocus);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DocumentSelection &&
          runtimeType == other.runtimeType &&
          anchor == other.anchor &&
          focus == other.focus;

  @override
  int get hashCode => Object.hash(anchor, focus);

  @override
  String toString() => isCollapsed
      ? 'DocumentSelection.collapsed($anchor)'
      : 'DocumentSelection(anchor: $anchor, focus: $focus)';
}


