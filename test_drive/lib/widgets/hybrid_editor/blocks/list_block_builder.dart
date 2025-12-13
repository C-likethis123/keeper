import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';
import 'inline_markdown_renderer.dart';

/// Builder for bullet list blocks
class BulletListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.bulletList;

  @override
  String? get triggerPrefix => '- ';

  @override
  String get markdownPrefix => '- ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _ListBlockWidget(config: config, isNumbered: false);
  }
}

/// Builder for numbered list blocks
class NumberedListBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.numberedList;

  @override
  String? get triggerPrefix => '1. ';

  @override
  String get markdownPrefix => '1. ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _ListBlockWidget(config: config, isNumbered: true);
  }
}

class _ListBlockWidget extends StatefulWidget {
  final BlockConfig config;
  final bool isNumbered;

  const _ListBlockWidget({
    required this.config,
    required this.isNumbered,
  });

  @override
  State<_ListBlockWidget> createState() => _ListBlockWidgetState();
}

class _ListBlockWidgetState extends State<_ListBlockWidget> {
  bool _showFormatted = true;

  BlockConfig get config => widget.config;
  bool get isNumbered => widget.isNumbered;

  @override
  void initState() {
    super.initState();
    config.focusNode.addListener(_onFocusChange);
    _showFormatted = !config.isFocused;
  }

  @override
  void didUpdateWidget(covariant _ListBlockWidget oldWidget) {
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

  Widget _buildBulletOrNumber(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyLarge ?? const TextStyle(fontSize: 16);

    if (isNumbered) {
      final number = config.listItemNumber ?? 1;
      return SizedBox(
        width: 28,
        child: Text(
          '$number.',
          style: textStyle.copyWith(
            color: theme.colorScheme.primary,
          ),
        ),
      );
    } else {
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

    // Handle Arrow Up
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      config.onFocusPrevious?.call();
      return KeyEventResult.handled;
    }

    // Handle Arrow Down
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      config.onFocusNext?.call();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyLarge ?? const TextStyle(fontSize: 16);

    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildBulletOrNumber(context),
          Expanded(
            child: _showFormatted && config.block.content.isNotEmpty
                ? GestureDetector(
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
                  )
                : FocusScope(
                    onKeyEvent: _handleKeyEvent,
                    child: TextField(
                      controller: config.controller,
                      focusNode: config.focusNode,
                      maxLines: null,
                      style: textStyle,
                      decoration: InputDecoration(
                        hintText: 'List item',
                        hintStyle: textStyle.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        isDense: true,
                      ),
                      onChanged: config.onContentChanged,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
