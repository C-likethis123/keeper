import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/themes/code_editor_theme.dart';
import 'package:test_drive/themes/syntax_theme.dart';
import 'package:test_drive/widgets/code_block_widget/code_block_header.dart';
import 'package:test_drive/widgets/code_block_widget/code_editor_widget.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/language_registry.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/smart_editing.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/syntax_highlighter.dart';
import 'package:test_drive/widgets/hybrid_editor/core/block_node.dart';

class CodeBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.codeBlock;

  @override
  RegExp? get triggerPrefix => RegExp(r'^```([a-z]+)*$');

  @override
  String get markdownPrefix => '```';

  @override
  bool get canHandleKeyEvent => true;

  @override
  Widget build(BuildContext context, BlockConfig config) {
    final syntaxTheme = Theme.of(context).extension<SyntaxTheme>()!;
    final highlighter = SyntaxHighlighter(theme: syntaxTheme);

    return highlighter.buildHighlightedCode(
      config.block.content,
      config.block.language ?? 'plaintext',
    );
  }

  @override
  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  ) {
    return (_) => CodeBlockEditor(config: config);
  }

  // ─────────────────────────────────────────────
  // Key handling (intent-based)
  // ─────────────────────────────────────────────

  @override
  KeyEventResult handleKeyEvent(BlockConfig config, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }

    final controller = config.controller;
    final text = controller.text;
    final cursor = controller.selection.baseOffset;

    final langConfig = LanguageRegistry.instance.getLanguage(
      config.block.language ?? 'plaintext',
    );
    final smartEditor = SmartEditingHandler(languageConfig: langConfig);

    // ── Escape always exits code block // TODO: why does the refactored code not call onfocusnext?
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      config.onFocusNext?.call();
      return KeyEventResult.handled;
    }

    // ── Enter: smart indentation
    if (event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      final result = smartEditor.handleEnter(text, cursor);
      if (result.handled) {
        _applyTextEdit(config, result);
        return KeyEventResult.handled;
      }
    }

    // ── Tab / Shift+Tab
    if (event.logicalKey == LogicalKeyboardKey.tab) {
      final result = smartEditor.handleTab(
        text,
        cursor,
        shift: HardwareKeyboard.instance.isShiftPressed,
      );
      if (result.handled) {
        _applyTextEdit(config, result);
        return KeyEventResult.handled;
      }
    }

    // ── Backspace (brace deletion)
    // does not work, it will still show ()) when there's somethign between them
    if (event.logicalKey == LogicalKeyboardKey.backspace &&
        controller.selection.isCollapsed) {
      final result = smartEditor.handleBackspace(text, cursor);
      if (result.handled) {
        _applyTextEdit(config, result);
        return KeyEventResult.handled;
      }
    }

    // Let editor/global handle the rest
    return KeyEventResult.ignored;
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  void _applyTextEdit(BlockConfig config, SmartEditResult result) {
    config.controller.value = TextEditingValue(
      text: result.newText,
      selection: TextSelection.collapsed(offset: result.newCursorOffset),
    );
    config.onContentChanged(result.newText);
  }

  @override
  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    final theme = Theme.of(context).extension<CodeEditorTheme>()!;

    return (child) => Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: theme.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CodeBlockHeader(
            selectedLanguage: config.block.language ?? 'plaintext',
            onLanguageChanged: (_) {},
            onCopyPressed: () =>
                Clipboard.setData(ClipboardData(text: config.block.content)),
            onDelete: config.onDelete,
          ),
          Padding(padding: const EdgeInsets.all(8), child: child),
        ],
      ),
    );
  }
}
