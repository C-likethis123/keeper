import 'package:flutter/foundation.dart';
import 'block_node.dart';
import 'selection.dart';

/// Immutable document representing the entire editor content.
///
/// The document is a flat list of blocks. All modifications return
/// a new Document instance, following the immutable pattern.
@immutable
class Document {
  final List<BlockNode> blocks;
  final int version;

  const Document._({required this.blocks, this.version = 0});

  /// Creates an empty document with a single paragraph
  factory Document.empty() {
    return Document._(blocks: [BlockNode.paragraph()]);
  }

  /// Creates a document from a list of blocks
  factory Document.fromBlocks(List<BlockNode> blocks) {
    if (blocks.isEmpty) {
      return Document.empty();
    }
    return Document._(blocks: List.unmodifiable(blocks));
  }

  /// Creates a document from markdown text
  factory Document.fromMarkdown(String markdown) {
    if (markdown.trim().isEmpty) {
      return Document.empty();
    }

    final blocks = <BlockNode>[];
    final lines = markdown.split('\n');

    int i = 0;
    while (i < lines.length) {
      final line = lines[i];

      // Check for code blocks
      if (line.startsWith('```')) {
        final language = line.substring(3).trim();
        final codeLines = <String>[];
        i++;

        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.add(lines[i]);
          i++;
        }

        blocks.add(
          BlockNode.codeBlock(
            content: codeLines.join('\n'),
            language: language.isEmpty ? null : language,
          ),
        );
        i++; // Skip closing ```
        continue;
      }

      // Check for headings
      if (line.startsWith('### ')) {
        blocks.add(BlockNode.heading(level: 3, content: line.substring(4)));
      } else if (line.startsWith('## ')) {
        blocks.add(BlockNode.heading(level: 2, content: line.substring(3)));
      } else if (line.startsWith('# ')) {
        blocks.add(BlockNode.heading(level: 1, content: line.substring(2)));
      } else if (RegExp(r'^(\s*)([-*]|\d+\.)\s+(.*)$').hasMatch(line)) {
        final listMatch = RegExp(
          r'^(\s*)([-*]|\d+\.)\s+(.*)$',
        ).firstMatch(line);
        if (listMatch != null) {
          final leadingSpaces = listMatch.group(1)!.length;
          final marker = listMatch.group(2)!;
          final content = listMatch.group(3)!;

          // 2 spaces per indent level, minimum level = 1
          final listLevel = (leadingSpaces ~/ 2);

          final isNumbered = marker.endsWith('.');

          blocks.add(
            BlockNode.list(
              numbered: isNumbered,
              content: content,
              listLevel: listLevel,
            ),
          );
        }
      } else if (line.isEmpty) {
        // Skip consecutive empty lines, but keep one as paragraph separator
        if (blocks.isNotEmpty && blocks.last.content.isNotEmpty) {
          blocks.add(BlockNode.paragraph(content: ''));
        }
      }
      // Regular paragraph
      else {
        blocks.add(BlockNode.paragraph(content: line));
      }

      i++;
    }

    if (blocks.isEmpty) {
      return Document.empty();
    }

    return Document._(blocks: List.unmodifiable(blocks));
  }

  /// Number of blocks in the document
  int get length => blocks.length;

  /// Whether the document is empty (only has one empty paragraph)
  bool get isEmpty =>
      blocks.length == 1 &&
      blocks.first.type == BlockType.paragraph &&
      blocks.first.content.isEmpty;

  /// Gets a block by index
  BlockNode operator [](int index) => blocks[index];

  /// Gets the block at the given position
  BlockNode blockAt(DocumentPosition position) => blocks[position.blockIndex];

  /// Creates a new document with the block at index replaced
  Document updateBlock(int index, BlockNode newBlock) {
    assert(index >= 0 && index < blocks.length, 'Block index out of range');
    final newBlocks = List<BlockNode>.from(blocks);
    newBlocks[index] = newBlock;
    return Document._(
      blocks: List.unmodifiable(newBlocks),
      version: version + 1,
    );
  }

  /// Creates a new document with a block inserted at index
  Document insertBlock(int index, BlockNode block) {
    assert(index >= 0 && index <= blocks.length, 'Insert index out of range');
    final newBlocks = List<BlockNode>.from(blocks);
    newBlocks.insert(index, block);
    return Document._(
      blocks: List.unmodifiable(newBlocks),
      version: version + 1,
    );
  }

  /// Creates a new document with the block at index removed
  Document removeBlock(int index) {
    assert(index >= 0 && index < blocks.length, 'Block index out of range');
    if (blocks.length == 1) {
      // Don't remove the last block, just clear it
      return updateBlock(0, BlockNode.paragraph());
    }
    final newBlocks = List<BlockNode>.from(blocks);
    newBlocks.removeAt(index);
    return Document._(
      blocks: List.unmodifiable(newBlocks),
      version: version + 1,
    );
  }

  /// Creates a new document with blocks replaced in a range
  Document replaceBlocks(int start, int end, List<BlockNode> newBlocks) {
    assert(start >= 0 && start <= blocks.length, 'Start index out of range');
    assert(end >= start && end <= blocks.length, 'End index out of range');

    final result = <BlockNode>[
      ...blocks.sublist(0, start),
      ...newBlocks,
      ...blocks.sublist(end),
    ];

    if (result.isEmpty) {
      return Document.empty();
    }

    return Document._(blocks: List.unmodifiable(result), version: version + 1);
  }

  /// Converts the document to markdown
  String toMarkdown() {
    final buffer = StringBuffer();
    for (int i = 0; i < blocks.length; i++) {
      buffer.write(blocks[i].toMarkdown());
      if (i < blocks.length - 1) {
        buffer.write('\n');
        // Add extra newline after code blocks
        if (blocks[i].isCodeBlock) {
          buffer.write('\n');
        }
      }
    }
    return buffer.toString();
  }

  /// Gets the total character count of the document
  int get characterCount {
    return blocks.fold(0, (sum, block) => sum + block.content.length);
  }

  /// Gets the word count of the document
  int get wordCount {
    return blocks.fold(0, (sum, block) {
      if (block.content.trim().isEmpty) return sum;
      return sum + block.content.trim().split(RegExp(r'\s+')).length;
    });
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Document &&
          runtimeType == other.runtimeType &&
          listEquals(blocks, other.blocks);

  @override
  int get hashCode => Object.hashAll(blocks);

  @override
  String toString() => 'Document(blocks: ${blocks.length}, version: $version)';
}
