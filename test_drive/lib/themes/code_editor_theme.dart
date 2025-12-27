import 'package:flutter/material.dart';

@immutable
class CodeEditorTheme extends ThemeExtension<CodeEditorTheme> {
  final Color background;
  final Color headerBackground;
  final Color border;
  final Color icon;
  final Color dropdownText;

  const CodeEditorTheme({
    required this.background,
    required this.headerBackground,
    required this.border,
    required this.icon,
    required this.dropdownText,
  });

  static const CodeEditorTheme dark = CodeEditorTheme(
    background: Color(0xFF1E1E1E),
    headerBackground: Color(0xFF252526),
    border: Color(0x1AFFFFFF),
    icon: Colors.white70,
    dropdownText: Colors.white70,
  );

  static const CodeEditorTheme light = CodeEditorTheme(
    background: Color(0xFF2D2D2D),
    headerBackground: Color(0xFF383838),
    border: Color(0x0DFFFFFF),
    icon: Colors.white70,
    dropdownText: Colors.white70,
  );

  @override
  CodeEditorTheme copyWith({
    Color? background,
    Color? headerBackground,
    Color? border,
    Color? icon,
    Color? dropdownText,
  }) {
    return CodeEditorTheme(
      background: background ?? this.background,
      headerBackground: headerBackground ?? this.headerBackground,
      border: border ?? this.border,
      icon: icon ?? this.icon,
      dropdownText: dropdownText ?? this.dropdownText,
    );
  }

  @override
  CodeEditorTheme lerp(ThemeExtension<CodeEditorTheme>? other, double t) {
    if (other is! CodeEditorTheme) return this;
    return CodeEditorTheme(
      background: Color.lerp(background, other.background, t)!,
      headerBackground: Color.lerp(
        headerBackground,
        other.headerBackground,
        t,
      )!,
      border: Color.lerp(border, other.border, t)!,
      icon: Color.lerp(icon, other.icon, t)!,
      dropdownText: Color.lerp(dropdownText, other.dropdownText, t)!,
    );
  }
}
