import 'package:flutter/material.dart';

@immutable
class SyntaxTheme extends ThemeExtension<SyntaxTheme> {
  final Color background;
  final Color defaultText;
  final Color keyword;
  final Color string;
  final Color number;
  final Color comment;
  final Color function;
  final Color typeOfVariable;
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
    required this.typeOfVariable,
    required this.variable,
    required this.operator,
    required this.punctuation,
    required this.attribute,
    required this.tag,
  });

  @override
  SyntaxTheme copyWith({
    Color? background,
    Color? defaultText,
    Color? keyword,
    Color? string,
    Color? number,
    Color? comment,
    Color? function,
    Color? typeOfVariable,
    Color? variable,
    Color? operator,
    Color? punctuation,
    Color? attribute,
    Color? tag,
  }) {
    return SyntaxTheme(
      background: background ?? this.background,
      defaultText: defaultText ?? this.defaultText,
      keyword: keyword ?? this.keyword,
      string: string ?? this.string,
      number: number ?? this.number,
      comment: comment ?? this.comment,
      function: function ?? this.function,
      typeOfVariable: typeOfVariable ?? this.typeOfVariable,
      variable: variable ?? this.variable,
      operator: operator ?? this.operator,
      punctuation: punctuation ?? this.punctuation,
      attribute: attribute ?? this.attribute,
      tag: tag ?? this.tag,
    );
  }

  @override
  SyntaxTheme lerp(
    ThemeExtension<SyntaxTheme>? other,
    double t,
  ) {
    if (other is! SyntaxTheme) return this;

    return SyntaxTheme(
      background: Color.lerp(background, other.background, t)!,
      defaultText: Color.lerp(defaultText, other.defaultText, t)!,
      keyword: Color.lerp(keyword, other.keyword, t)!,
      string: Color.lerp(string, other.string, t)!,
      number: Color.lerp(number, other.number, t)!,
      comment: Color.lerp(comment, other.comment, t)!,
      function: Color.lerp(function, other.function, t)!,
      typeOfVariable: Color.lerp(typeOfVariable, other.typeOfVariable, t)!,
      variable: Color.lerp(variable, other.variable, t)!,
      operator: Color.lerp(operator, other.operator, t)!,
      punctuation: Color.lerp(punctuation, other.punctuation, t)!,
      attribute: Color.lerp(attribute, other.attribute, t)!,
      tag: Color.lerp(tag, other.tag, t)!,
    );
  }

  Color getColorForClass(String? className) {
    if (className == null) return defaultText;

    if (className.contains('keyword')) return keyword;
    if (className.contains('string')) return string;
    if (className.contains('number')) return number;
    if (className.contains('comment')) return comment;
    if (className.contains('function')) return function;
    if (className.contains('type') || className.contains('class')) return typeOfVariable;
    if (className.contains('variable') || className.contains('params')) {
      return variable;
    }
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

  static const SyntaxTheme theme = SyntaxTheme(
    background: Color(0xFF1E1E1E),
    defaultText: Color(0xFFD4D4D4),
    keyword: Color(0xFF569CD6),
    string: Color(0xFFCE9178),
    number: Color(0xFFB5CEA8),
    comment: Color(0xFF6A9955),
    function: Color(0xFFDCDCAA),
    typeOfVariable: Color(0xFF4EC9B0),
    variable: Color(0xFF9CDCFE),
    operator: Color(0xFFD4D4D4),
    punctuation: Color(0xFFD4D4D4),
    attribute: Color(0xFF9CDCFE),
    tag: Color(0xFF569CD6),
  );
}
