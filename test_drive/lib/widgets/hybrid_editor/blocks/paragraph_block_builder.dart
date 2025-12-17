import 'package:flutter/material.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';
import 'editor_block.dart';

/// Builder for paragraph blocks
class ParagraphBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.paragraph;

  @override
  String? get triggerPrefix => null; // Paragraphs are the default

  @override
  String get markdownPrefix => '';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}
