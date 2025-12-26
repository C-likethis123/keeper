import 'package:flutter/foundation.dart';

/// Enum representing all possible block types in the editor
enum BlockType {
  paragraph,
  heading1,
  heading2,
  heading3,
  bulletList,
  numberedList,
  codeBlock,
  mathBlock,
}

/// Immutable node representing a block of content in the document.
/// 
/// Each block has a unique ID, type, and content. Code blocks also
/// store the programming language for syntax highlighting.
@immutable
class BlockNode {
  final String id;
  final BlockType type;
  final String content;
  final String? language; // For code blocks
  final int listLevel; // For list blocks
  final Map<String, dynamic> attributes;

  const BlockNode({
    required this.id,
    required this.type,
    required this.content,
    this.language,
    this.listLevel = 0,
    this.attributes = const {},
  });

  /// Creates a new paragraph block with generated ID
  factory BlockNode.paragraph({String content = ''}) {
    return BlockNode(
      id: generateId(),
      type: BlockType.paragraph,
      content: content,
    );
  }

  /// Creates a new heading block
  factory BlockNode.heading({
    required int level,
    String content = '',
  }) {
    assert(level >= 1 && level <= 3, 'Heading level must be 1, 2, or 3');
    final type = switch (level) {
      1 => BlockType.heading1,
      2 => BlockType.heading2,
      3 => BlockType.heading3,
      _ => BlockType.heading1,
    };
    return BlockNode(
      id: generateId(),
      type: type,
      content: content,
    );
  }

  /// Creates a new list block
  factory BlockNode.list({
    required bool numbered,
    String content = '',
    int listLevel = 0,
  }) {
    return BlockNode(
      id: generateId(),
      type: numbered ? BlockType.numberedList : BlockType.bulletList,
      content: content,
      listLevel: listLevel,
    );
  }

  /// Creates a new code block
  factory BlockNode.codeBlock({
    String content = '',
    String? language,
  }) {
    return BlockNode(
      id: generateId(),
      type: BlockType.codeBlock,
      content: content,
      language: language,
    );
  }

  factory BlockNode.mathBlock({
    String content = '',
  }) {
    return BlockNode(
      id: generateId(),
      type: BlockType.mathBlock,
      content: content,
    );
  }

  /// Creates a copy of this block with updated fields
  BlockNode copyWith({
    String? id,
    BlockType? type,
    String? content,
    String? language,
    int? listLevel,
    Map<String, dynamic>? attributes,
  }) {
    return BlockNode(
      id: id ?? this.id,
      type: type ?? this.type,
      content: content ?? this.content,
      language: language ?? this.language,
      listLevel: listLevel ?? this.listLevel,
      attributes: attributes ?? this.attributes,
    );
  }

  /// Converts the block to its markdown representation
  String toMarkdown() {
    final listIndentation = '${'  ' * listLevel}';
    switch (type) {
      case BlockType.heading1:
        return '# $content';
      case BlockType.heading2:
        return '## $content';
      case BlockType.heading3:
        return '### $content';
      case BlockType.bulletList:
        return '$listIndentation- $content';
      // TODO: make the list item number part of the node, not part of the config
      case BlockType.numberedList:
        return '${listIndentation}1. $content';
      case BlockType.codeBlock:
        final lang = language ?? '';
        return '```$lang\n$content\n```';
      case BlockType.mathBlock:
        return '\$\$\n$content\n\$\$';
      case BlockType.paragraph:
        return content;
    }
  }

  /// Gets the heading level if this is a heading block
  int? get headingLevel => switch (type) {
    BlockType.heading1 => 1,
    BlockType.heading2 => 2,
    BlockType.heading3 => 3,
    _ => null,
  };

  BlockType get blockType => type;

  /// Whether this block is a code block
  bool get isCodeBlock => type == BlockType.codeBlock;

  /// Whether this block is a list item
  bool get isListItem => 
    type == BlockType.bulletList || type == BlockType.numberedList;

  /// Whether this block is a heading
  bool get isHeading => 
    type == BlockType.heading1 || 
    type == BlockType.heading2 || 
    type == BlockType.heading3;

  static int _idCounter = 0;
  static String generateId() => 'block_${++_idCounter}_${DateTime.now().microsecondsSinceEpoch}';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BlockNode &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          type == other.type &&
          content == other.content &&
          listLevel == other.listLevel &&
          language == other.language;

  @override
  int get hashCode => Object.hash(id, type, content, listLevel, language);

  @override
  String toString() => 'BlockNode(id: $id, type: $type, content: "${content.length > 20 ? '${content.substring(0, 20)}...' : content}", listLevel: $listLevel, language: $language)';
}

