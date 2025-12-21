import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'language_registry.dart';
import 'smart_editing.dart';
import 'syntax_theme.dart';

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
  final VoidCallback? onEscape;
  final bool readOnly;
  final bool showLineNumbers;
  final double fontSize;

  const CodeEditorWidget({
    super.key,
    required this.code,
    this.language = 'plaintext',
    this.focusNode,
    this.onChanged,
    this.onEscape,
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
  late TextStyle _codeStyle;

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

    // Create a consistent code style used by both layers
    _codeStyle = GoogleFonts.firaCode(
      fontSize: widget.fontSize,
      height: 1.5,
      color: SyntaxTheme.dark.defaultText,
    );

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
      widget.onEscape?.call();
      return KeyEventResult.handled;
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
    const syntaxTheme = SyntaxTheme.dark;
    final lineCount = '\n'.allMatches(_controller.text).length + 1;

    return Container(
      constraints: const BoxConstraints(minHeight: 60),
      color: const Color(0xFF1E1E1E), // VS Code dark background
      child: Focus(
        onKeyEvent: _handleKeyEvent,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Line numbers
            if (widget.showLineNumbers)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  border: Border(
                    right: BorderSide(
                      color: Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                ),
                child: SingleChildScrollView(
                  controller: _lineNumberScrollController,
                  physics: const NeverScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: List.generate(lineCount, (index) {
                      return Text(
                        '${index + 1}',
                        style: _codeStyle.copyWith(color: syntaxTheme.comment),
                      );
                    }),
                  ),
                ),
              ),

            // Code editor
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.all(8),
                child: Stack(
                  children: [
                    // Highlighted code (background layer) - use Text widget for consistent rendering
                    _buildHighlightedCode(syntaxTheme),

                    // Invisible text field (input layer) - positioned to exactly overlay
                    SizedBox(
                      width: double.infinity,
                      child: EditableText(
                        controller: _controller,
                        focusNode: _focusNode,
                        style: _codeStyle.copyWith(color: Colors.transparent),
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

  Widget _buildHighlightedCode(SyntaxTheme theme) {
    final code = _controller.text;
    final result = LanguageRegistry.instance.highlightCode(
      code,
      widget.language,
    );

    if (result == null || result.nodes == null) {
      return Text(code, style: _codeStyle);
    }

    final spans = _processNodes(result.nodes!, theme);
    return RichText(
      text: TextSpan(style: _codeStyle, children: spans),
    );
  }

  List<TextSpan> _processNodes(
    List<dynamic> nodes,
    SyntaxTheme theme, {
    String? parentClass,
  }) {
    final spans = <TextSpan>[];
    for (final node in nodes) {
      final effectiveClass = node.className ?? parentClass;
      final color = theme.getColorForClass(effectiveClass);

      if (node.value != null && (node.value as String).isNotEmpty) {
        spans.add(
          TextSpan(
            text: node.value as String,
            style: _codeStyle.copyWith(color: color),
          ),
        );
      }

      if (node.children != null) {
        spans.addAll(
          _processNodes(
            node.children as List<dynamic>,
            theme,
            parentClass: effectiveClass,
          ),
        );
      }
    }
    return spans;
  }
}
