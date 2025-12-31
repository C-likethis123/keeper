import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/inline_markdown_renderer.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/list_marker.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';

/// Builder for bullet list blocks
class BulletListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.bulletList;

  @override
  RegExp? get triggerPrefix => RegExp(r'^-');

  @override
  String get markdownPrefix => '- ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.bodyLarge!,
      onTap: config.onTap,
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
      onChanged: config.onContentChanged,
      decoration: InputDecoration(border: InputBorder.none, isDense: true),
    );
  }

  @override
  blockConfiguration(BuildContext context, BlockConfig config) {
    return (child) => Padding(
      padding: EdgeInsets.only(left: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListMarker(
            type: config.block.type,
            listLevel: config.block.listLevel,
            listItemNumber: config.listItemNumber ?? 1,
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  config.focusNode.requestFocus();
                });
              },
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

/// Builder for numbered list blocks
class NumberedListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.numberedList;

  @override
  RegExp? get triggerPrefix => RegExp(r'^(\d+)\.');

  @override
  String get markdownPrefix => '1. ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.bodyLarge!,
      onTap: config.onTap,
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
      onChanged: config.onContentChanged,
      decoration: InputDecoration(border: InputBorder.none, isDense: true),
    );
  }

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    return (child) => Padding(
      padding: EdgeInsets.only(left: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListMarker(
            type: config.block.type,
            listLevel: config.block.listLevel,
            listItemNumber: config.listItemNumber ?? 1,
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  config.focusNode.requestFocus();
                });
              },
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}
