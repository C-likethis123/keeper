import 'package:flutter/material.dart';
import 'block_config.dart';

class EditorBlockWidget extends StatefulWidget {
  final BlockConfig config;
  final Widget formattedView;
  final Function(bool isFormatted) editableText;
  final Widget Function(Widget child) blockConfiguration;

  const EditorBlockWidget({
    super.key,
    required this.config,
    required this.formattedView,
    required this.editableText,
    required this.blockConfiguration,
  });

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

  // KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
  //   if (event is! KeyDownEvent) return KeyEventResult.ignored;

  //   final selection = config.controller.selection;

  //   if (event.logicalKey == LogicalKeyboardKey.tab) {
  //     if (HardwareKeyboard.instance.isShiftPressed) {
  //       config.onTabReverse();
  //     } else {
  //       config.onTab();
  //     }
  //     return KeyEventResult.handled;
  //   }

  //   // BACKSPACE → remove style
  //   // onDelete is not used?
  //   if (event.logicalKey == LogicalKeyboardKey.backspace) {
  //     if (config.hasBlockSelection) {
  //       config.deleteSelectedBlocks();
  //       return KeyEventResult.handled;
  //     } else {
  //       final atStart = selection.isCollapsed && selection.baseOffset == 0;

  //       if (atStart) {
  //         config.onBackspaceAtStart();
  //         return KeyEventResult.handled;
  //       }
  //     }
  //   }

  //   // ENTER → split / new block
  //   if (event.logicalKey == LogicalKeyboardKey.enter &&
  //       !HardwareKeyboard.instance.isShiftPressed) {
  //     config.onEnter();
  //     return KeyEventResult.handled;
  //   }

  //   // arrows
  //   if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
  //     config.onFocusPrevious?.call();
  //     return KeyEventResult.handled;
  //   }

  //   if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
  //     config.onFocusNext?.call();
  //     return KeyEventResult.handled;
  //   }

  //   // spaces
  //   if (event.logicalKey == LogicalKeyboardKey.space) {
  //     config.onSpace.call();
  //     return KeyEventResult.handled;
  //   }

  //   if (event.logicalKey == LogicalKeyboardKey.keyV &&
  //       HardwareKeyboard.instance.isMetaPressed) {
  //     config.onPaste?.call();
  //     return KeyEventResult.handled;
  //   }

  //   return KeyEventResult.ignored;
  // }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: config.isBlockSelected
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
            : null,
      ),
      child: _buildBlock(context),
    );
  }

  Widget _buildBlock(BuildContext context) {
    final BlockContainer = widget.blockConfiguration;

    return BlockContainer(
      Stack(
        alignment: Alignment.topLeft,
        children: [
          // Formatted markdown view
          if (_showFormatted) widget.formattedView,
          // Editable text (disabled when formatted view is active)
          // I don't know why this was wrapped in an ignorepointer
          IgnorePointer(
            ignoring: false,
            child: Focus(
              child: widget.editableText(_showFormatted),
            ),
          ),
        ],
      ),
    );
  }
}
