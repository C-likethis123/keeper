import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';

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
    return Center(
      child: Math.tex(
        config.block.content,
        mathStyle: MathStyle.display,
        textStyle: Theme.of(context).textTheme.bodyLarge!,
        onErrorFallback: (error) =>
            Text(error.message, style: const TextStyle(color: Colors.red)),
      ),
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyLarge!;
    return (isFormatted) => EditableText(
      controller: config.controller,
      focusNode: config.focusNode,
      style: textStyle.copyWith(
        color: config.isFocused ? textStyle.color : Colors.transparent,
      ),
      cursorColor: theme.colorScheme.primary,
      backgroundCursorColor: Colors.grey,
      maxLines: null,
      onChanged: config.onContentChanged,
    );
  }

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    final theme = Theme.of(context);
    return (child) => Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: config.isFocused
            ? theme.colorScheme.surfaceContainerHighest.withAlpha(77)
            : theme.colorScheme.surfaceContainerHighest.withAlpha(25),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: config.isFocused
              ? theme.colorScheme.primary
              : theme.colorScheme.outline.withAlpha(77),
          width: 1.2,
        ),
      ),
      child: Stack(
        children: [
          child,
          Positioned(
            right: 0,
            child: IconButton(
              icon: Icon(
                Icons.delete_outline,
                size: 20,
                color: theme.colorScheme.onSurfaceVariant,
              ),
              padding: EdgeInsets.zero,
              constraints: BoxConstraints(),
              onPressed: config.onDelete,
            ),
          ),
        ],
      ),
    );
  }
}
