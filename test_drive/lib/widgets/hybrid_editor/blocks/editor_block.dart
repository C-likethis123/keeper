import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/core.dart';
import 'block_config.dart';
import 'inline_markdown_renderer.dart';

class EditorBlockWidget extends StatefulWidget {
  final BlockConfig config;

  const EditorBlockWidget({super.key, required this.config});

  @override
  State<EditorBlockWidget> createState() => _EditorBlockWidgetState();
}

class _EditorBlockWidgetState extends State<EditorBlockWidget> {
  bool _showFormatted = true;

  BlockConfig get config => widget.config;

  @override
  void initState() {
    super.initState();
    config.focusNode.addListener(_onFocusChange);
    _showFormatted = !config.focusNode.hasFocus;
  }

  @override
  void didUpdateWidget(covariant EditorBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.config.focusNode != config.focusNode) {
      oldWidget.config.focusNode.removeListener(_onFocusChange);
      config.focusNode.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    config.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    if (!mounted) return;
    setState(() {
      _showFormatted = !config.focusNode.hasFocus;
    });
  }

  TextStyle _editorStyle(BuildContext context) {
    final theme = Theme.of(context);

    return switch (config.block.type) {
      BlockType.heading1 => theme.textTheme.headlineLarge!,
      BlockType.heading2 => theme.textTheme.headlineMedium!,
      BlockType.heading3 => theme.textTheme.headlineSmall!,
      _ => theme.textTheme.bodyLarge!,
    };
  }

  Widget _buildListMarker(BuildContext context) {
    final theme = Theme.of(context);
    final style = theme.textTheme.bodyLarge ?? const TextStyle(fontSize: 16);

    if (config.block.type == BlockType.numberedList) {
      final number = config.listItemNumber ?? 1;
      return SizedBox(
        width: 28,
        child: Text(
          '$number.',
          style: style.copyWith(color: theme.colorScheme.primary),
        ),
      );
    }

    if (config.block.type == BlockType.bulletList) {
      return Container(
        width: 24,
        alignment: Alignment.centerLeft,
        child: Container(
          width: 6,
          height: 6,
          margin: const EdgeInsets.only(left: 4, top: 8),
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
          ),
        ),
      );
    }

    return const SizedBox(width: 0);
  }

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final selection = config.controller.selection;

    // BACKSPACE → remove style
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      final atStart = selection.isCollapsed && selection.baseOffset == 0;

      if (atStart) {
        config.onBackspaceAtStart();
        return KeyEventResult.handled;
      }
    }

    // ENTER → split / new block
    if (event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      config.onEnter();
      return KeyEventResult.handled;
    }

    // arrows
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      config.onFocusPrevious?.call();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      config.onFocusNext?.call();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = _editorStyle(context);

    final isList =
        config.block.type == BlockType.bulletList ||
        config.block.type == BlockType.numberedList;

    return Padding(
      padding: EdgeInsets.only(left: isList ? 8 : 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isList) _buildListMarker(context),
          Expanded(
            child: Stack(
              alignment: Alignment.topLeft,
              children: [
                // Formatted view
                IgnorePointer(
                  ignoring: !_showFormatted,
                  child: Opacity(
                    opacity: _showFormatted ? 1 : 0,
                    child: GestureDetector(
                      onTap: () {
                        setState(() => _showFormatted = false);
                        config.focusNode.requestFocus();
                      },
                      child: InlineMarkdownRenderer(
                        text: config.block.content,
                        style: textStyle,
                      ),
                    ),
                  ),
                ),

                // Editable TextField with key handling
                IgnorePointer(
                  ignoring: _showFormatted,
                  child: Opacity(
                    opacity: _showFormatted ? 0 : 1,
                    child: Focus(
                      onKeyEvent: _onKeyEvent,
                      child: TextField(
                        controller: config.controller,
                        focusNode: config.focusNode,
                        maxLines: null,
                        style: textStyle,
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                        ),
                        onChanged: config.onContentChanged,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
