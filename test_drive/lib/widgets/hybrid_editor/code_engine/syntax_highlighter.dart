import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:highlight/highlight.dart' show Node;
import 'language_registry.dart';
import 'syntax_theme.dart';

/// Converts highlighted code to Flutter TextSpans
class SyntaxHighlighter {
  final LanguageRegistry registry;
  final SyntaxTheme theme;
  final double fontSize;
  final double lineHeight;

  SyntaxHighlighter({
    LanguageRegistry? registry,
    SyntaxTheme? theme,
    this.fontSize = 14.0,
    this.lineHeight = 1.5,
  })  : registry = registry ?? LanguageRegistry.instance,
        theme = theme ?? SyntaxTheme.theme;

  /// Gets the base text style for code
  TextStyle get baseStyle => GoogleFonts.firaCode(
        fontSize: fontSize,
        height: lineHeight,
        color: theme.defaultText,
      );

  /// Highlights code and returns a list of TextSpans
  List<TextSpan> highlight(String code, String language) {
    final result = registry.highlightCode(code, language);
    
    if (result == null || result.nodes == null) {
      return [TextSpan(text: code, style: baseStyle)];
    }

    return _processNodes(result.nodes!);
  }

  List<TextSpan> _processNodes(List<Node> nodes) {
    final spans = <TextSpan>[];

    for (final node in nodes) {
      if (node.value != null) {
        spans.add(TextSpan(
          text: node.value,
          style: baseStyle.copyWith(
            color: theme.getColorForClass(node.className),
          ),
        ));
      } else if (node.children != null) {
        spans.add(TextSpan(
          children: _processNodes(node.children!),
          style: baseStyle.copyWith(
            color: theme.getColorForClass(node.className),
          ),
        ));
      }
    }

    return spans;
  }

  /// Builds a RichText widget from highlighted code
  Widget buildHighlightedCode(String code, String language) {
    final spans = highlight(code, language);
    return RichText(
      text: TextSpan(children: spans),
    );
  }

  /// Builds highlighted lines with line numbers
  Widget buildHighlightedLines({
    required String code,
    required String language,
    bool showLineNumbers = true,
    int startLine = 1,
  }) {
    final lines = code.split('\n');
    final spans = highlight(code, language);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showLineNumbers)
          _buildLineNumbers(lines.length, startLine),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: RichText(
              text: TextSpan(children: spans),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLineNumbers(int lineCount, int startLine) {
    final lineNumberStyle = baseStyle.copyWith(
      color: theme.comment,
    );

    return Container(
      padding: const EdgeInsets.only(right: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(lineCount, (index) {
          return Text(
            '${startLine + index}',
            style: lineNumberStyle,
          );
        }),
      ),
    );
  }
}

