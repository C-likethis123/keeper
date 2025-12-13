import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';
import 'inline_markdown_renderer.dart';

/// Builder for paragraph blocks
class ParagraphBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.paragraph;

  @override
  String? get triggerPrefix => null; // Paragraphs are the default

  @override
  String get markdownPrefix => '';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _ParagraphBlockWidget(config: config);
  }
}

class _ParagraphBlockWidget extends StatefulWidget {
  final BlockConfig config;

  const _ParagraphBlockWidget({required this.config});

  @override
  State<_ParagraphBlockWidget> createState() => _ParagraphBlockWidgetState();
}

class _ParagraphBlockWidgetState extends State<_ParagraphBlockWidget> {
  bool _showFormatted = true;

  BlockConfig get config => widget.config;

  @override
  void initState() {
    super.initState();
    config.focusNode.addListener(_onFocusChange);
    _showFormatted = !config.isFocused;
  }

  @override
  void didUpdateWidget(covariant _ParagraphBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.config.focusNode != config.focusNode) {
      oldWidget.config.focusNode.removeListener(_onFocusChange);
      config.focusNode.addListener(_onFocusChange);
    }
    if (!config.isFocused && !_showFormatted) {
      setState(() => _showFormatted = true);
    }
  }

  @override
  void dispose() {
    config.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    if (mounted) {
      setState(() {
        _showFormatted = !config.focusNode.hasFocus;
      });
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    // Handle Enter
    if (event.logicalKey == LogicalKeyboardKey.enter && 
        !HardwareKeyboard.instance.isShiftPressed) {
      config.onEnter();
      return KeyEventResult.handled;
    }

    // Handle Backspace at start or on empty
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      if (config.controller.text.isEmpty || 
          (config.controller.selection.isCollapsed && 
           config.controller.selection.baseOffset == 0)) {
        config.onBackspaceAtStart();
        return KeyEventResult.handled;
      }
    }

    // Handle Arrow Up at first line
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      if (config.controller.selection.isCollapsed && _isAtFirstLine()) {
        config.onFocusPrevious?.call();
        return KeyEventResult.handled;
      }
    }

    // Handle Arrow Down at last line
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      if (config.controller.selection.isCollapsed && _isAtLastLine()) {
        config.onFocusNext?.call();
        return KeyEventResult.handled;
      }
    }

    return KeyEventResult.ignored;
  }

  bool _isAtFirstLine() {
    final text = config.controller.text;
    final cursorPos = config.controller.selection.baseOffset;
    if (cursorPos > text.length) return true;
    return !text.substring(0, cursorPos).contains('\n');
  }

  bool _isAtLastLine() {
    final text = config.controller.text;
    final cursorPos = config.controller.selection.baseOffset;
    if (cursorPos > text.length) return true;
    return !text.substring(cursorPos).contains('\n');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyLarge ?? const TextStyle(fontSize: 16);

    if (_showFormatted && config.block.content.isNotEmpty) {
      return GestureDetector(
        onTap: () {
          setState(() => _showFormatted = false);
          config.focusNode.requestFocus();
        },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: InlineMarkdownRenderer(
            text: config.block.content,
            style: textStyle,
          ),
        ),
      );
    }

    return FocusScope(
      onKeyEvent: _handleKeyEvent,
      child: TextField(
        controller: config.controller,
        focusNode: config.focusNode,
        maxLines: null,
        style: textStyle,
        decoration: InputDecoration(
          hintText: config.index == 0 ? 'Start writing...' : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 4),
          isDense: true,
        ),
        onChanged: config.onContentChanged,
      ),
    );
  }
}
