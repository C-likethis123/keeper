import 'package:flutter/material.dart';
import '../core/core.dart';
import 'block_config.dart';
import 'block_builder.dart';
import 'block_type_detection.dart';

/// Registry for block builders
///
/// The registry maps block types to their builders, allowing for
/// extensible block type support.
class BlockRegistry {
  final Map<BlockType, BlockBuilder> _builders = {};

  /// Singleton instance
  static final BlockRegistry instance = BlockRegistry._();

  BlockRegistry._();

  /// Registers a builder for a block type
  void register(BlockBuilder builder) {
    _builders[builder.type] = builder;
  }

  /// Registers multiple builders
  void registerAll(List<BlockBuilder> builders) {
    for (final builder in builders) {
      register(builder);
    }
  }

  /// Gets the builder for a block type
  /// TODO: is there a way to indicate that the builders map has all the block types?
  BlockBuilder getBuilder(BlockType type) => _builders[type]!;

  /// Builds a widget for a block
  Widget build(BuildContext context, BlockConfig config) {
    final builder = _builders[config.block.type];
    if (builder == null) {
      return _buildFallback(context, config);
    }
    return builder.build(context, config);
  }

  /// Fallback widget for unknown block types
  Widget _buildFallback(BuildContext context, BlockConfig config) {
    return Container(
      padding: const EdgeInsets.all(8),
      color: Theme.of(context).colorScheme.errorContainer,
      child: Text(
        'Unknown block type: ${config.block.type}',
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    );
  }

  /// Detects block type from text input (e.g., "# " -> heading1)
  BlockTypeDetection? detectBlockType(String text) {
    for (final builder in _builders.values) {
      final prefix = builder.triggerPrefix;
      if (prefix == null) {
        continue;
      }
      final matches = prefix.firstMatch(text);
      if (matches != null) {
        return BlockTypeDetection(
          type: builder.type,
          prefix: matches.group(0)!,
          remainingContent: text.substring(matches.end),
          language: builder.type == BlockType.codeBlock
              ? (matches.group(1) ?? 'plaintext')
              : null,
        );
      }
    }
    return null;
  }

  /// Gets all registered block types
  List<BlockType> get registeredTypes => _builders.keys.toList();
}
