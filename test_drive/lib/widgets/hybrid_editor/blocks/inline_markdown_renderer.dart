import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/inline_math_block.dart';

/// Renders inline markdown formatting (bold, italic, code, links)
class InlineMarkdownRenderer extends StatelessWidget {
  final String text;
  final TextStyle style;
  final Function(String url) onTap;

  const InlineMarkdownRenderer({
    super.key,
    required this.text,
    required this.style,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final spans = _parseInlineMarkdown(text, style, context);
    return RichText(text: TextSpan(children: spans));
  }

  List<InlineSpan> _parseInlineMarkdown(
    String text,
    TextStyle baseStyle,
    BuildContext context,
  ) {
    final spans = <InlineSpan>[];
    final buffer = StringBuffer();
    int i = 0;

    void flushBuffer() {
      if (buffer.isNotEmpty) {
        spans.add(TextSpan(text: buffer.toString(), style: baseStyle));
        buffer.clear();
      }
    }

    while (i < text.length) {
      // Check for links: [text](url)
      if (text[i] == '[' && !_isEscaped(text, i)) {
        final closeBracket = text.indexOf(']', i);
        if (closeBracket != -1 &&
            closeBracket + 1 < text.length &&
            text[closeBracket + 1] == '(') {
          final closeParenIndex = text.indexOf(')', closeBracket + 2);
          if (closeParenIndex != -1) {
            flushBuffer();
            final linkText = text.substring(i + 1, closeBracket);
            final url = text.substring(closeBracket + 2, closeParenIndex);

            spans.add(
              TextSpan(
                text: linkText,
                style: baseStyle.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  decoration: TextDecoration.underline,
                ),
                recognizer: TapGestureRecognizer()
                  ..onTap = () {
                    onTap(url);
                  },
              ),
            );

            i = closeParenIndex + 1;
            continue;
          }
        }
      }

      // Inline LaTeX: $...$
      if (text[i] == r'$' && !_isEscaped(text, i)) {
        final endIndex = _findUnescapedChar(text, r'$', i + 1);
        if (endIndex != -1) {
          flushBuffer();

          final latex = text.substring(i + 1, endIndex);

          spans.add(
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: InlineMath(latex: latex, style: baseStyle),
            ),
          );

          i = endIndex + 1;
          continue;
        }
      }

      // Check for inline code: `code`
      if (text[i] == '`' && !_isEscaped(text, i)) {
        final endIndex = text.indexOf('`', i + 1);
        if (endIndex != -1) {
          flushBuffer();
          final code = text.substring(i + 1, endIndex);
          spans.add(
            TextSpan(text: code, style: _codeStyle(baseStyle, context)),
          );
          i = endIndex + 1;
          continue;
        }
      }

      // Check for bold: **text** or __text__
      if (i + 1 < text.length &&
          ((text[i] == '*' && text[i + 1] == '*') ||
              (text[i] == '_' && text[i + 1] == '_')) &&
          !_isEscaped(text, i)) {
        final marker = text.substring(i, i + 2);
        final endIndex = text.indexOf(marker, i + 2);
        if (endIndex != -1) {
          flushBuffer();
          final boldText = text.substring(i + 2, endIndex);
          // Recursively parse the bold text for nested formatting
          spans.add(
            TextSpan(
              children: _parseInlineMarkdown(
                boldText,
                baseStyle.copyWith(fontWeight: FontWeight.bold),
                context,
              ),
            ),
          );
          i = endIndex + 2;
          continue;
        }
      }

      // Check for italic: *text* or _text_
      if ((text[i] == '*' || text[i] == '_') && !_isEscaped(text, i)) {
        final marker = text[i];
        // Make sure it's not bold
        if (i + 1 < text.length && text[i + 1] != marker) {
          final endIndex = _findUnescapedChar(text, marker, i + 1);
          if (endIndex != -1 && endIndex > i + 1) {
            flushBuffer();
            final italicText = text.substring(i + 1, endIndex);
            spans.add(
              TextSpan(
                children: _parseInlineMarkdown(
                  italicText,
                  baseStyle.copyWith(fontStyle: FontStyle.italic),
                  context,
                ),
              ),
            );
            i = endIndex + 1;
            continue;
          }
        }
      }

      // Check for strikethrough: ~~text~~
      if (i + 1 < text.length &&
          text[i] == '~' &&
          text[i + 1] == '~' &&
          !_isEscaped(text, i)) {
        final endIndex = text.indexOf('~~', i + 2);
        if (endIndex != -1) {
          flushBuffer();
          final strikeText = text.substring(i + 2, endIndex);
          spans.add(
            TextSpan(
              text: strikeText,
              style: baseStyle.copyWith(decoration: TextDecoration.lineThrough),
            ),
          );
          i = endIndex + 2;
          continue;
        }
      }

      // Check for links: [text](url)
      if (text[i] == '[' && !_isEscaped(text, i)) {
        final closeBracket = text.indexOf(']', i);
        if (closeBracket != -1 &&
            closeBracket + 1 < text.length &&
            text[closeBracket + 1] == '(') {
          final closeParenIndex = text.indexOf(')', closeBracket + 2);
          if (closeParenIndex != -1) {
            flushBuffer();
            final linkText = text.substring(i + 1, closeBracket);
            // final url = text.substring(closeBracket + 2, closeParenIndex);
            spans.add(
              TextSpan(
                text: linkText,
                style: baseStyle.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            );
            i = closeParenIndex + 1;
            continue;
          }
        }
      }

      // Regular character
      buffer.write(text[i]);
      i++;
    }

    flushBuffer();
    return spans;
  }

  TextStyle _codeStyle(TextStyle baseStyle, BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return GoogleFonts.firaCode(
      fontSize: baseStyle.fontSize != null ? baseStyle.fontSize! * 0.9 : 14,
      backgroundColor: colorScheme.surfaceContainerHighest,
      color: colorScheme.primary,
    );
  }

  bool _isEscaped(String text, int index) {
    if (index == 0) return false;
    int backslashCount = 0;
    int i = index - 1;
    while (i >= 0 && text[i] == '\\') {
      backslashCount++;
      i--;
    }
    return backslashCount % 2 == 1;
  }

  int _findUnescapedChar(String text, String char, int startIndex) {
    for (int i = startIndex; i < text.length; i++) {
      if (text[i] == char && !_isEscaped(text, i)) {
        return i;
      }
    }
    return -1;
  }
}
