import 'package:flutter/material.dart';
import 'package:test_drive/themes/code_editor_theme.dart';
import 'package:test_drive/themes/syntax_theme.dart';

import 'screens/home_screen.dart';

class KeeperApp extends StatelessWidget {
  const KeeperApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Keeper',
      theme: ThemeData(
        brightness: Brightness.light,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blueAccent,
          brightness: Brightness.light,
        ),
        extensions: const [SyntaxTheme.theme, CodeEditorTheme.light],
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blueAccent,
          brightness: Brightness.dark,
        ),
        extensions: const [CodeEditorTheme.dark, SyntaxTheme.theme],
      ),
      themeMode: ThemeMode.light,
      home: const HomeScreen(),
    );
  }
}
