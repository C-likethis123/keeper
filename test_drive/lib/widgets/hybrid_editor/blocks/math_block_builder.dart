import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/editor_block.dart';

import '../core/block_node.dart';
import 'block_builder.dart';

class MathBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.mathBlock;

  @override
  RegExp? get triggerPrefix => RegExp(r'^\$\$');

  @override
  String get markdownPrefix => '\$\$';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}