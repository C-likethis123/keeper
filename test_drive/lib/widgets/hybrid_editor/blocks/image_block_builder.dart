import 'dart:io';

import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';
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
    return Image.file(
      File(config.block.content),
      width: 100.0,
      height: 200.0,
      fit: BoxFit.contain,
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    final textStyle = Theme.of(context).textTheme.bodyLarge!;
    return (isFormatted) => TextField(
      controller: config.controller,
      focusNode: config.focusNode,
      maxLines: null,
      style: textStyle.copyWith(
        color: isFormatted ? Colors.transparent : textStyle.color,
      ),
      decoration: InputDecoration(border: InputBorder.none, isDense: true),
      onChanged: config.onContentChanged,
    );
  }
}
