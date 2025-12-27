import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:test_drive/themes/code_editor_theme.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/syntax_highlighter.dart';
import '../hybrid_editor/code_engine/language_registry.dart';
import '../hybrid_editor/code_engine/smart_editing.dart';
import '../../themes/syntax_theme.dart';

/// A full-featured code editor widget
///
/// Features:
/// - Syntax highlighting
/// - Line numbers
/// - Smart indentation
/// - Brace completion
/// - Bracket matching
class CodeEditorWidget extends StatefulWidget {
  final String code;
  final String language;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onFocusNext;
  final VoidCallback? onFocusPrevious;
  final bool readOnly;
  final bool showLineNumbers;
  final double fontSize;

  const CodeEditorWidget({
    super.key,
    required this.code,
    this.language = 'plaintext',
    this.focusNode,
    this.onChanged,
    this.onFocusNext,
    this.onFocusPrevious,
    this.readOnly = false,
    this.showLineNumbers = true,
    this.fontSize = 14.0,
  });

  @override
  State<CodeEditorWidget> createState() => _CodeEditorWidgetState();
}

class _CodeEditorWidgetState extends State<CodeEditorWidget> {
  late TextEditingController _controller;
  late FocusNode _focusNode;
  late ScrollController _scrollController;
  late ScrollController _lineNumberScrollController;
  late SmartEditingHandler _smartEditor;

  bool _isDisposed = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.code);
    _focusNode = widget.focusNode ?? FocusNode();
    _scrollController = ScrollController();
    _lineNumberScrollController = ScrollController();

    final langConfig = LanguageRegistry.instance.getLanguage(widget.language);
    _smartEditor = SmartEditingHandler(languageConfig: langConfig);

    _controller.addListener(_onTextChanged);
    _scrollController.addListener(_syncScroll);
  }

  @override
  void didUpdateWidget(covariant CodeEditorWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.code != widget.code && _controller.text != widget.code) {
      _controller.text = widget.code;
    }
    if (oldWidget.language != widget.language) {
      final langConfig = LanguageRegistry.instance.getLanguage(widget.language);
      _smartEditor = SmartEditingHandler(languageConfig: langConfig);
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    _controller.removeListener(_onTextChanged);
    _scrollController.removeListener(_syncScroll);
    _controller.dispose();
    if (widget.focusNode == null) {
      _focusNode.dispose();
    }
    _scrollController.dispose();
    _lineNumberScrollController.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (_isDisposed) return;
    // Trigger rebuild for syntax highlighting update
    setState(() {});
  }

  void _syncScroll() {
    if (_lineNumberScrollController.hasClients) {
      _lineNumberScrollController.jumpTo(_scrollController.offset);
    }
  }

  void _handleTextChange(String newText, int newCursorOffset) {
    _controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: newCursorOffset),
    );
    widget.onChanged?.call(newText);
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }

    // Handle Escape to exit code block
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      widget.onFocusNext?.call();
      return KeyEventResult.handled;
    }

    // Also escape if the user presses the down arrow key and it's the last block.
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      final lines = _controller.text.split('\n');
      final cursorOffset = _controller.selection.baseOffset;
      final currentLineIndex =
          _controller.text.substring(0, cursorOffset).split('\n').length - 1;
      final isLastLine = currentLineIndex == lines.length - 1;
      if (isLastLine) {
        widget.onFocusNext?.call();
        return KeyEventResult.handled;
      }
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      final cursorOffset = _controller.selection.baseOffset;
      final currentLineIndex =
          _controller.text.substring(0, cursorOffset).split('\n').length - 1;
      final isFirstLine = currentLineIndex == 0;
      if (isFirstLine) {
        widget.onFocusPrevious?.call();
        return KeyEventResult.handled;
      }
    }

    // Handle Enter for smart indentation
    if (event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      final result = _smartEditor.handleEnter(
        _controller.text,
        _controller.selection.baseOffset,
      );
      if (result.handled) {
        _handleTextChange(result.newText, result.newCursorOffset);
        return KeyEventResult.handled;
      }
    }

    // Handle Tab for indentation
    if (event.logicalKey == LogicalKeyboardKey.tab) {
      final shift = HardwareKeyboard.instance.isShiftPressed;
      final result = _smartEditor.handleTab(
        _controller.text,
        _controller.selection.baseOffset,
        shift: shift,
      );
      if (result.handled) {
        _handleTextChange(result.newText, result.newCursorOffset);
        return KeyEventResult.handled;
      }
    }

    // Handle Backspace for brace deletion
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      if (_controller.selection.isCollapsed) {
        final result = _smartEditor.handleBackspace(
          _controller.text,
          _controller.selection.baseOffset,
        );
        if (result.handled) {
          _handleTextChange(result.newText, result.newCursorOffset);
          return KeyEventResult.handled;
        }
      }
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final syntaxTheme = Theme.of(context).extension<SyntaxTheme>()!;
    final codeTheme = Theme.of(context).extension<CodeEditorTheme>()!;
    final syntaxHighlighter = SyntaxHighlighter(theme: syntaxTheme);
    final codeStyle = GoogleFonts.firaCode(
      fontSize: widget.fontSize,
      height: 1.5,
      color: syntaxTheme.defaultText,
    );
    final lineCount = '\n'.allMatches(_controller.text).length + 1;

    return Container(
      constraints: const BoxConstraints(minHeight: 60),
      color: codeTheme.background, // VS Code dark background
      child: Focus(
        onKeyEvent: _handleKeyEvent,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Line numbers
            if (widget.showLineNumbers)
              syntaxHighlighter.buildHighlightedLines(
                lineCount: lineCount,
                lineNumberScrollController: _lineNumberScrollController,
              ),
            // Code editor
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.all(8),
                child: Stack(
                  children: [
                    // Highlighted code (background layer) - use Text widget for consistent rendering
                    syntaxHighlighter.buildHighlightedCode(
                      _controller.text,
                      widget.language,
                    ),
                    // Invisible text field (input layer) - positioned to exactly overlay
                    SizedBox(
                      width: double.infinity,
                      child: EditableText(
                        controller: _controller,
                        focusNode: _focusNode,
                        style: codeStyle.copyWith(color: Colors.transparent),
                        cursorColor: syntaxTheme.defaultText,
                        backgroundCursorColor: Colors.grey,
                        maxLines: null,
                        readOnly: widget.readOnly,
                        onChanged: (text) {
                          _handleBraceCompletion(text);
                          widget.onChanged?.call(text);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleBraceCompletion(String newText) {
    if (newText.length != _controller.text.length) return;

    // This is called after the text has already changed, so we check
    // if we need to handle brace completion for the last inserted character
    final cursorPos = _controller.selection.baseOffset;
    if (cursorPos > 0 && cursorPos <= newText.length) {
      final insertedChar = newText[cursorPos - 1];

      // Check if we should auto-complete
      if ('{(["\'`'.contains(insertedChar)) {
        final result = _smartEditor.handleCharacterInsert(
          insertedChar,
          newText.substring(0, cursorPos - 1) + newText.substring(cursorPos),
          cursorPos - 1,
        );
        if (result.handled && result.newText != newText) {
          // Schedule the update for the next frame to avoid issues
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!_isDisposed) {
              _controller.value = TextEditingValue(
                text: result.newText,
                selection: TextSelection.collapsed(
                  offset: result.newCursorOffset,
                ),
              );
            }
          });
        }
      }
    }
  }
}
