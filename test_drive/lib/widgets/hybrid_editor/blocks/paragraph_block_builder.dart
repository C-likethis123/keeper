import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/inline_markdown_renderer.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_trigger.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';

/// Builder for paragraph blocks
///
/// Paragraphs are the default block type. They support inline markdown
/// formatting and wiki link trigger detection (reported to editor via callbacks).
class ParagraphBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.paragraph;

  @override
  RegExp? get triggerPrefix => null; // Paragraphs are default

  @override
  String get markdownPrefix => '';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return InlineMarkdownRenderer(
      text: config.block.content,
      style: Theme.of(context).textTheme.bodyLarge!,
      onTap: config.onTap,
    );
  }

  @override
  bool get canHandleKeyEvent => false;

  @override
  KeyEventResult handleKeyEvent(BlockConfig config, KeyEvent event) {
    // Wiki keyboard handling is now done at editor level
    return KeyEventResult.ignored;
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    return (isFormatted) {
      final textStyle = Theme.of(context).textTheme.bodyLarge!;
      final controller = config.controller;
      final focusNode = config.focusNode;

      // Detect wiki link triggers and report to editor via callbacks
      // The overlay is rendered at editor level, not here
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!focusNode.hasFocus) {
          // If focus is lost, end wiki session
          config.onWikiTriggerEnd?.call();
          return;
        }

        final caret = controller.selection.baseOffset;
        final start = WikiTrigger.findStart(controller.text, caret);

        if (start != null) {
          // Found [[ trigger - report to editor
          config.onWikiTriggerStart?.call(start);
          // Update query as user types
          final query = controller.text.substring(start + 2, caret);
          config.onWikiQueryUpdate?.call(query, caret);
        } else {
          // No trigger found - end any active session
          config.onWikiTriggerEnd?.call();
        }
      });

      // Simple TextField, no overlay here
      return TextField(
        controller: controller,
        focusNode: focusNode,
        maxLines: null,
        style: textStyle.copyWith(
          color: isFormatted ? Colors.transparent : textStyle.color,
        ),
        decoration: const InputDecoration(
          border: InputBorder.none,
          isDense: true,
        ),
        onChanged: config.onContentChanged,
      );
    };
  }
}
