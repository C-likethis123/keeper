import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/core.dart';
import 'block_builder.dart';
import 'block_config.dart';

/// Builder for heading level 1 blocks
class Heading1BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading1;

  @override
  String? get triggerPrefix => '# ';

  @override
  String get markdownPrefix => '# ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _HeadingBlockWidget(config: config, level: 1);
  }
}

/// Builder for heading level 2 blocks
class Heading2BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading2;

  @override
  String? get triggerPrefix => '## ';

  @override
  String get markdownPrefix => '## ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _HeadingBlockWidget(config: config, level: 2);
  }
}

/// Builder for heading level 3 blocks
class Heading3BlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.heading3;

  @override
  String? get triggerPrefix => '### ';

  @override
  String get markdownPrefix => '### ';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _HeadingBlockWidget(config: config, level: 3);
  }
}

class _HeadingBlockWidget extends StatefulWidget {
  final BlockConfig config;
  final int level;

  const _HeadingBlockWidget({
    required this.config,
    required this.level,
  });

  @override
  State<_HeadingBlockWidget> createState() => _HeadingBlockWidgetState();
}

class _HeadingBlockWidgetState extends State<_HeadingBlockWidget> {
  bool _showFormatted = true;

  BlockConfig get config => widget.config;
  int get level => widget.level;

  TextStyle _getHeadingStyle(BuildContext context) {
    final theme = Theme.of(context);
    return switch (level) {
      1 => theme.textTheme.headlineLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ) ??
          const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
      2 => theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ) ??
          const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
      3 => theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ) ??
          const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      _ => theme.textTheme.headlineSmall ?? const TextStyle(fontSize: 20),
    };
  }

  @override
  void initState() {
    super.initState();
    config.focusNode.addListener(_onFocusChange);
    _showFormatted = !config.isFocused;
  }

  @override
  void didUpdateWidget(covariant _HeadingBlockWidget oldWidget) {
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
    final headingStyle = _getHeadingStyle(context);

    if (_showFormatted && config.block.content.isNotEmpty) {
      return GestureDetector(
        onTap: () {
          setState(() => _showFormatted = false);
          config.focusNode.requestFocus();
        },
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.only(
            top: level == 1 ? 16 : (level == 2 ? 12 : 8),
            bottom: 4,
          ),
          child: Text(
            config.block.content,
            style: headingStyle,
          ),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(
        top: level == 1 ? 16 : (level == 2 ? 12 : 8),
        bottom: 4,
      ),
      child: FocusScope(
        onKeyEvent: _handleKeyEvent,
        child: TextField(
          controller: config.controller,
          focusNode: config.focusNode,
          maxLines: null,
          style: headingStyle,
          decoration: InputDecoration(
            hintText: 'Heading $level',
            hintStyle: headingStyle.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
            isDense: true,
          ),
          onChanged: config.onContentChanged,
        ),
      ),
    );
  }
}
