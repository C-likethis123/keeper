import 'package:flutter/material.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';
import 'editor_block.dart';

/// Builder for heading level 1 blocks
class Heading1BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading1;

  @override
  String? get triggerPrefix => '# ';

  @override
  String get markdownPrefix => '# ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}

/// Builder for heading level 2 blocks
class Heading2BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading2;

  @override
  String? get triggerPrefix => '## ';

  @override
  String get markdownPrefix => '## ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}

/// Builder for heading level 3 blocks
class Heading3BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading3;

  @override
  String? get triggerPrefix => '### ';

  @override
  String get markdownPrefix => '### ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return EditorBlockWidget(config: config);
  }
}

