import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:test_drive/themes/code_editor_theme.dart';
import 'package:test_drive/themes/syntax_theme.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/language_registry.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/smart_editing.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/syntax_highlighter.dart';

class CodeBlockEditor extends StatefulWidget {
  final BlockConfig config;

  const CodeBlockEditor({super.key, required this.config});

  @override
  State<CodeBlockEditor> createState() => CodeBlockEditorState();
}

class CodeBlockEditorState extends State<CodeBlockEditor> {
  late ScrollController _scrollController;
  late ScrollController _lineNumberScrollController;
  late SmartEditingHandler _smartEditor;

  @override
  void initState() {
    super.initState();

    _scrollController = ScrollController();
    _lineNumberScrollController = ScrollController();

    final langConfig = LanguageRegistry.instance.getLanguage(
      widget.config.block.language ?? 'plaintext',
    );
    _smartEditor = SmartEditingHandler(languageConfig: langConfig);

    _scrollController.addListener(_syncScroll);
  }

  @override
  void didUpdateWidget(covariant CodeBlockEditor oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.config.block.language != widget.config.block.language) {
      final langConfig = LanguageRegistry.instance.getLanguage(
        widget.config.block.language ?? 'plaintext',
      );
      _smartEditor = SmartEditingHandler(languageConfig: langConfig);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_syncScroll);
    _scrollController.dispose();
    _lineNumberScrollController.dispose();
    super.dispose();
  }

  void _syncScroll() {
    if (_lineNumberScrollController.hasClients) {
      _lineNumberScrollController.jumpTo(_scrollController.offset);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    final syntaxTheme = Theme.of(context).extension<SyntaxTheme>()!;
    final codeTheme = Theme.of(context).extension<CodeEditorTheme>()!;
    final highlighter = SyntaxHighlighter(theme: syntaxTheme);

    final text = config.controller.text;
    final lineCount = '\n'.allMatches(text).length + 1;

    final codeStyle = GoogleFonts.firaCode(
      fontSize: 14,
      height: 1.5,
      color: Colors.transparent,
    );

    return Container(
      color: codeTheme.background,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Line numbers
          highlighter.buildHighlightedLines(
            lineCount: lineCount,
            lineNumberScrollController: _lineNumberScrollController,
          ),

          // ── Code editor
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(8),
              child: Stack(
                children: [
                  // Highlighted code
                  highlighter.buildHighlightedCode(
                    text,
                    config.block.language ?? 'plaintext',
                  ),

                  // Editable layer
                  EditableText(
                    controller: config.controller,
                    focusNode: config.focusNode,
                    style: codeStyle,
                    cursorColor: syntaxTheme.defaultText,
                    backgroundCursorColor: Colors.grey,
                    maxLines: null,
                    onChanged: (text) {
                      _handleBraceCompletion(
                        controller: config.controller,
                        smartEditor: _smartEditor,
                      );
                      config.onContentChanged(config.controller.text);
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _handleBraceCompletion({
    required TextEditingController controller,
    required SmartEditingHandler smartEditor,
  }) {
    final text = controller.text;
    final cursor = controller.selection.baseOffset;

    if (cursor <= 0 || cursor > text.length) return;

    final insertedChar = text[cursor - 1];
    if (!'{(["\'`'.contains(insertedChar)) return;

    final result = smartEditor.handleCharacterInsert(
      insertedChar,
      text.substring(0, cursor - 1) + text.substring(cursor),
      cursor - 1,
    );

    if (result.handled && result.newText != text) {
      controller.value = TextEditingValue(
        text: result.newText,
        selection: TextSelection.collapsed(offset: result.newCursorOffset),
      );
    }
  }
}
