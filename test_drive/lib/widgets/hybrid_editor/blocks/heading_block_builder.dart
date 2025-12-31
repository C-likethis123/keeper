import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/inline_markdown_renderer.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';

/// Builder for heading level 1 blocks
class Heading1BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading1;

  @override
  RegExp? get triggerPrefix => RegExp(r'^#');

  @override
  String get markdownPrefix => '# ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.headlineLarge!,
      onTap: config.onTap,
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    final textStyle = Theme.of(context).textTheme.headlineLarge!;
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

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    return (child) => Padding(
      padding: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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

/// Builder for heading level 2 blocks
class Heading2BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading2;

  @override
  RegExp? get triggerPrefix => RegExp(r'^##');

  @override
  String get markdownPrefix => '## ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.headlineMedium!,
      onTap: config.onTap,
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    final textStyle = Theme.of(context).textTheme.headlineMedium!;
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

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    return (child) => Padding(
      padding: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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

/// Builder for heading level 3 blocks
class Heading3BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading3;

  @override
  RegExp? get triggerPrefix => RegExp(r'^###');

  @override
  String get markdownPrefix => '### ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.headlineSmall!,
      onTap: config.onTap,
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    final textStyle = Theme.of(context).textTheme.headlineSmall!;
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

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    return (child) => Padding(
      padding: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
