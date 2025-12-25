import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/widgets/code_block_widget.dart';

import '../core/core.dart';
import 'block_config.dart';
import 'inline_markdown_renderer.dart';
import 'list_marker.dart';

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

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final selection = config.controller.selection;

    if (event.logicalKey == LogicalKeyboardKey.tab) {
      if (HardwareKeyboard.instance.isShiftPressed) {
        config.onTabReverse();
      } else {
        config.onTab();
      }
      return KeyEventResult.handled;
    }

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

    // spaces
    if (event.logicalKey == LogicalKeyboardKey.space) {
      config.onSpace.call();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final textStyle = _editorStyle(context);

    final isCodeBlock = config.block.type == BlockType.codeBlock;
    if (isCodeBlock) {
      return CodeBlockWidget(config: config);
    }

    final isList =
        config.block.type == BlockType.bulletList ||
        config.block.type == BlockType.numberedList;

    return Padding(
      padding: EdgeInsets.only(left: isList ? 8 : 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isList)
            ListMarker(
              type: config.block.type,
              listLevel: config.block.listLevel,
              listItemNumber: config.listItemNumber ?? 1,
            ),
          Expanded(
            child: Stack(
              alignment: Alignment.topLeft,
              children: [
                // Formatted view
                // shows this at first. but the gesture detector does not work and ontap does not work.
                if (_showFormatted)
                  GestureDetector(
                    onTap: () {
                      setState(() => _showFormatted = false);
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        config.focusNode.requestFocus();
                      });
                    },
                    child: InlineMarkdownRenderer(
                      text: config.block.content,
                      style: textStyle,
                    ),
                  ),
                // Editable TextField with key handling
                Focus(
                  onKeyEvent: _onKeyEvent,
                  child: TextField(
                    controller: config.controller,
                    focusNode: config.focusNode,
                    maxLines: null,
                    onTap: () {
                      setState(() => _showFormatted = false);
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        config.focusNode.requestFocus();
                      });
                    },
                    style: textStyle,
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                    ),
                    onChanged: config.onContentChanged,
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
