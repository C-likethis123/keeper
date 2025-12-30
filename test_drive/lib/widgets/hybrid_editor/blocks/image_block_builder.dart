import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/editor_block.dart';
import 'package:test_drive/widgets/hybrid_editor/core/block_node.dart';

class ImageBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.image;

  @override
  String get markdownPrefix => '![]';
  @override
  RegExp? get triggerPrefix => RegExp(r'^!\[.*\]\((.*)\)$');

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}
