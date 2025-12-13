import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'block_config.dart';
import 'block_builder.dart';
import '../core/block_node.dart';
import '../code_engine/code_editor_widget.dart';
import '../code_engine/language_registry.dart';

/// Builder for code blocks
/// 
/// This builder creates a full code editor experience with:
/// - Syntax highlighting
/// - Line numbers
/// - Smart indentation
/// - Brace completion
/// - Bracket matching
class CodeBlockBuilder extends BlockBuilder {
  @override
  BlockType get type => BlockType.codeBlock;

  @override
  String? get triggerPrefix => '```';

  @override
  String get markdownPrefix => '```';

  @override
  Widget build(BuildContext context, BlockConfig config) {
    return _CodeBlockWidget(config: config);
  }
}

class _CodeBlockWidget extends StatefulWidget {
  final BlockConfig config;

  const _CodeBlockWidget({required this.config});

  @override
  State<_CodeBlockWidget> createState() => _CodeBlockWidgetState();
}

class _CodeBlockWidgetState extends State<_CodeBlockWidget> {
  BlockConfig get config => widget.config;
  String? _selectedLanguage;

  @override
  void initState() {
    super.initState();
    _selectedLanguage = config.block.language;
  }

  @override
  void didUpdateWidget(covariant _CodeBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.config.block.language != config.block.language) {
      _selectedLanguage = config.block.language;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    // Use dark background for code blocks regardless of theme for better contrast
    final backgroundColor = isDark 
        ? const Color(0xFF1E1E1E) 
        : const Color(0xFF2D2D2D);
    final borderColor = isDark 
        ? Colors.white.withValues(alpha: 0.1)
        : Colors.white.withValues(alpha: 0.05);
    final headerColor = isDark 
        ? const Color(0xFF252526) 
        : const Color(0xFF383838);

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Language selector header
          _buildHeader(context, headerColor),
          // Code editor
          CodeEditorWidget(
            code: config.block.content,
            language: _selectedLanguage ?? 'plaintext',
            focusNode: config.focusNode,
            onChanged: config.onContentChanged,
            onEscape: config.onFocusNext,
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Color headerColor) {
    final theme = Theme.of(context);
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
          const Icon(
            Icons.code,
            size: 16,
            color: Colors.white70,
          ),
          const SizedBox(width: 8),
          // Language dropdown
          DropdownButton<String>(
            value: _selectedLanguage ?? 'plaintext',
            dropdownColor: headerColor,
            style: theme.textTheme.labelMedium?.copyWith(
              color: Colors.white70,
            ),
            underline: const SizedBox(),
            isDense: true,
            icon: const Icon(Icons.arrow_drop_down, color: Colors.white70, size: 18),
            items: [
              const DropdownMenuItem(
                value: 'plaintext',
                child: Text('Plain Text', style: TextStyle(color: Colors.white70)),
              ),
              ...languages.map((lang) => DropdownMenuItem(
                value: lang,
                child: Text(
                  _formatLanguageName(lang),
                  style: const TextStyle(color: Colors.white70),
                ),
              )),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _selectedLanguage = value);
                // Update the block's language
                // Note: This would need to be propagated up to the editor state
                // For now, it just changes the local display
              }
            },
          ),
          const Spacer(),
          // Copy button
          IconButton(
            icon: const Icon(
              Icons.copy,
              size: 16,
              color: Colors.white70,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(
              minWidth: 28,
              minHeight: 28,
            ),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: config.block.content));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Code copied to clipboard'),
                  duration: Duration(seconds: 1),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            tooltip: 'Copy code',
          ),
          // Delete button
          IconButton(
            icon: const Icon(
              Icons.delete_outline,
              size: 16,
              color: Colors.white70,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(
              minWidth: 28,
              minHeight: 28,
            ),
            onPressed: config.onDelete,
            tooltip: 'Delete code block',
          ),
        ],
      ),
    );
  }

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
}
