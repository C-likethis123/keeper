import 'package:flutter/material.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';
import 'editor_block.dart';

/// Builder for bullet list blocks
class BulletListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.bulletList;

  @override
  RegExp? get triggerPrefix => RegExp(r'^- ');

  @override
  String get markdownPrefix => '- ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}

/// Builder for numbered list blocks
class NumberedListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.numberedList;

  @override
  RegExp? get triggerPrefix => RegExp(r'^(\d+)\.\s');

  @override
  String get markdownPrefix => '1. ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}
