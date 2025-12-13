import '../core/block_node.dart';

/// Result of block type detection
class BlockTypeDetection {
  final BlockType type;
  final String prefix;
  final String remainingContent;

  const BlockTypeDetection({
    required this.type,
    required this.prefix,
    required this.remainingContent,
  });
}
