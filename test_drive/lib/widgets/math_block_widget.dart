import 'package:flutter/services.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';

class MathBlockWidget extends StatelessWidget {
  final BlockConfig config;

  const MathBlockWidget({super.key, required this.config});

  KeyEventResult onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    // Escape if down arrow pressed on last line
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      final cursorOffset = config.controller.selection.baseOffset;
      final currentLineIndex =
          config.controller.text.substring(0, cursorOffset).split('\n').length -
          1;
      final isFirstLine = currentLineIndex == 0;
      if (isFirstLine) {
        config.onFocusPrevious?.call();
        return KeyEventResult.handled;
      }
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      final lines = config.controller.text.split('\n');
      final cursorOffset = config.controller.selection.baseOffset;
      final currentLineIndex =
          config.controller.text.substring(0, cursorOffset).split('\n').length -
          1;
      final isLastLine = currentLineIndex == lines.length - 1;
      if (isLastLine) {
        config.onFocusNext?.call();
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyLarge!;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: config.isFocused
            ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3)
            : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: config.isFocused
              ? theme.colorScheme.primary
              : theme.colorScheme.outline.withValues(alpha: 0.3),
          width: 1.2,
        ),
      ),
      child: Focus(
        onKeyEvent: onKeyEvent,
        child: Stack(
          children: [
            if (!config.isFocused)
              Math.tex(
                config.block.content,
                mathStyle: MathStyle.display,
                textStyle: textStyle.copyWith(
                  fontSize: textStyle.fontSize! * 1.1, // slightly larger
                  fontWeight: FontWeight.w500,
                  color: theme.colorScheme.onSurface,
                ),
                onErrorFallback: (error) => Text(
                  error.message,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            EditableText(
              controller: config.controller,
              focusNode: config.focusNode,
              style: textStyle.copyWith(
                color: config.isFocused ? textStyle.color : Colors.transparent,
              ),
              cursorColor: theme.colorScheme.primary,
              backgroundCursorColor: Colors.grey,
              maxLines: null,
              onChanged: config.onContentChanged,
            ),
          ],
        ),
      ),
    );
  }
}
