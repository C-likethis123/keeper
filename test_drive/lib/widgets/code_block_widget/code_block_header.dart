import 'package:flutter/material.dart';
import 'package:test_drive/themes/code_editor_theme.dart';
import 'package:test_drive/widgets/hybrid_editor/code_engine/language_registry.dart';

/// This widget is used to display the header of a code block
/// where users can perform actions like changing the language, deleting the block, etc.
class CodeBlockHeader extends StatelessWidget {
  const CodeBlockHeader({
    super.key,
    required this.selectedLanguage,
    required this.onLanguageChanged,
    required this.onCopyPressed,
    required this.onDelete,
  });
  final String selectedLanguage;
  final Function(String?) onLanguageChanged;
  final VoidCallback onCopyPressed;
  final VoidCallback onDelete;

  String _formatLanguageName(String language) {
    final names = {
      'dart': 'Dart',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'kotlin': 'Kotlin',
      'swift': 'Swift',
      'go': 'Go',
      'rust': 'Rust',
      'c': 'C',
      'cpp': 'C++',
      'csharp': 'C#',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'yaml': 'YAML',
      'sql': 'SQL',
      'shell': 'Shell',
      'bash': 'Bash',
      'plaintext': 'Plain Text',
    };
    return names[language.toLowerCase()] ?? language;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final codeTheme = Theme.of(context).extension<CodeEditorTheme>()!;
    final headerColor = codeTheme.headerBackground;
    final languages = LanguageRegistry.instance.languages;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: headerColor,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(8),
          topRight: Radius.circular(8),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.code, size: 16, color: Colors.white70),
          const SizedBox(width: 8),
          // Language dropdown
          DropdownButton<String>(
            value: selectedLanguage,
            dropdownColor: headerColor,
            style: theme.textTheme.labelMedium?.copyWith(color: Colors.white70),
            underline: const SizedBox(),
            isDense: true,
            icon: const Icon(
              Icons.arrow_drop_down,
              color: Colors.white70,
              size: 18,
            ),
            items: [
              const DropdownMenuItem(
                value: 'plaintext',
                child: Text(
                  'Plain Text',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
              ...languages.map(
                (lang) => DropdownMenuItem(
                  value: lang,
                  child: Text(
                    _formatLanguageName(lang),
                    style: const TextStyle(color: Colors.white70),
                  ),
                ),
              ),
            ],
            onChanged: onLanguageChanged,
          ),
          const Spacer(),
          // Copy button
          IconButton(
            icon: const Icon(Icons.copy, size: 16, color: Colors.white70),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            onPressed: onCopyPressed,
            tooltip: 'Copy code',
          ),
          IconButton(
            icon: const Icon(
              Icons.delete_outline,
              size: 16,
              color: Colors.white70,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            onPressed: onDelete,
            tooltip: 'Delete code block',
          ),
        ],
      ),
    );
  }
}
