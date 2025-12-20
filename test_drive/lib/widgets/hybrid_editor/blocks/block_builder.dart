import 'package:flutter/material.dart';
import 'block_config.dart';
import '../core/block_node.dart';
/// Abstract base class for block builders
abstract class BlockBuilder {
  /// The block type this builder handles
  BlockType get type;

  /// Builds the widget for this block type
  Widget build(BuildContext context, BlockConfig config);

  /// Returns the prefix that triggers this block type (e.g., "# " for heading1)
  RegExp? get triggerPrefix => null;

  /// Returns the markdown prefix for this block type
  String get markdownPrefix;
}