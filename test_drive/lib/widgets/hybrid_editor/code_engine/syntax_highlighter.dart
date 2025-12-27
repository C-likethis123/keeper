import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'language_registry.dart';
import '../../../themes/syntax_theme.dart';

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
  }) : registry = registry ?? LanguageRegistry.instance,
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

  List<TextSpan> _processNodes(List<dynamic> nodes, {String? parentClass}) {
    final spans = <TextSpan>[];

    for (final node in nodes) {
      final effectiveClass = node.className ?? parentClass;
      final color = theme.getColorForClass(effectiveClass);
      if (node.value != null && (node.value as String).isNotEmpty) {
        spans.add(
          TextSpan(
            text: node.value,
            style: baseStyle.copyWith(color: color),
          ),
        );
      }
      if (node.children != null) {
        spans.addAll(
          _processNodes(
            node.children as List<dynamic>,
            parentClass: effectiveClass,
          ),
        );
      }
    }

    return spans;
  }

  /// Builds a RichText widget from highlighted code
  Widget buildHighlightedCode(String code, String language) {
    final spans = highlight(code, language);
    return RichText(text: TextSpan(children: spans));
  }

  /// Builds highlighted lines with line numbers
  Widget buildHighlightedLines({
    required int lineCount,
    required ScrollController lineNumberScrollController,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: SingleChildScrollView(
        controller: lineNumberScrollController,
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(lineCount, (index) {
            return Text(
              '${index + 1}',
              style: baseStyle.copyWith(color: theme.comment),
            );
          }),
        ),
      ),
    );
  }
}
