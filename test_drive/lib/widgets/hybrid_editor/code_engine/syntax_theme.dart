
import 'dart:ui';

/// Theme for syntax highlighting
class SyntaxTheme {
  final Color background;
  final Color defaultText;
  final Color keyword;
  final Color string;
  final Color number;
  final Color comment;
  final Color function;
  final Color type;
  final Color variable;
  final Color operator;
  final Color punctuation;
  final Color attribute;
  final Color tag;

  const SyntaxTheme({
    required this.background,
    required this.defaultText,
    required this.keyword,
    required this.string,
    required this.number,
    required this.comment,
    required this.function,
    required this.type,
    required this.variable,
    required this.operator,
    required this.punctuation,
    required this.attribute,
    required this.tag,
  });

  /// Dark theme inspired by VS Code Dark+
  static const SyntaxTheme dark = SyntaxTheme(
    background: Color(0xFF1E1E1E),
    defaultText: Color(0xFFD4D4D4),
    keyword: Color(0xFF569CD6),
    string: Color(0xFFCE9178),
    number: Color(0xFFB5CEA8),
    comment: Color(0xFF6A9955),
    function: Color(0xFFDCDCAA),
    type: Color(0xFF4EC9B0),
    variable: Color(0xFF9CDCFE),
    operator: Color(0xFFD4D4D4),
    punctuation: Color(0xFFD4D4D4),
    attribute: Color(0xFF9CDCFE),
    tag: Color(0xFF569CD6),
  );

  /// Light theme
  static const SyntaxTheme light = SyntaxTheme(
    background: Color(0xFFFFFFFF),
    defaultText: Color(0xFF000000),
    keyword: Color(0xFF0000FF),
    string: Color(0xFFA31515),
    number: Color(0xFF098658),
    comment: Color(0xFF008000),
    function: Color(0xFF795E26),
    type: Color(0xFF267F99),
    variable: Color(0xFF001080),
    operator: Color(0xFF000000),
    punctuation: Color(0xFF000000),
    attribute: Color(0xFFFF0000),
    tag: Color(0xFF800000),
  );

  /// Gets color for a highlight.js class
  Color getColorForClass(String? className) {
    if (className == null) return defaultText;

    if (className.contains('keyword')) return keyword;
    if (className.contains('string')) return string;
    if (className.contains('number')) return number;
    if (className.contains('comment')) return comment;
    if (className.contains('function')) return function;
    if (className.contains('type') || className.contains('class')) return type;
    if (className.contains('variable') || className.contains('params')) return variable;
    if (className.contains('operator')) return operator;
    if (className.contains('punctuation')) return punctuation;
    if (className.contains('attr')) return attribute;
    if (className.contains('tag')) return tag;
    if (className.contains('built_in')) return function;
    if (className.contains('literal')) return keyword;
    if (className.contains('symbol')) return variable;
    if (className.contains('title')) return function;

    return defaultText;
  }
}

