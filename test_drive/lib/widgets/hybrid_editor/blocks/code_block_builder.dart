import 'package:flutter/material.dart';
import 'block_config.dart';
import 'block_builder.dart';
import '../core/block_node.dart';

import 'editor_block.dart';

class CodeBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.codeBlock;

  @override
  RegExp? get triggerPrefix => RegExp(r'^```\w*$');

  @override
  String get markdownPrefix => '```';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}

