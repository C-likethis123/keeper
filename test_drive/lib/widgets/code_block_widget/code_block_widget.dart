import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/widgets/code_block_widget/code_block_header.dart';
import 'package:test_drive/widgets/code_editor_theme.dart';
import '../hybrid_editor/blocks/block_config.dart';

import 'code_editor_widget.dart';

/// This widget creates a full code editor experience with:
/// - Syntax highlighting
/// - Line numbers
/// - Smart indentation
/// - Brace completion
/// - Bracket matching
class CodeBlockWidget extends StatefulWidget {
  final BlockConfig config;

  const CodeBlockWidget({required this.config});

  @override
  State<CodeBlockWidget> createState() => CodeBlockWidgetState();
}

class CodeBlockWidgetState extends State<CodeBlockWidget> {
  BlockConfig get config => widget.config;
  String? _selectedLanguage;

  @override
  void initState() {
    super.initState();
    _selectedLanguage = config.block.language;
  }

  @override
  void didUpdateWidget(covariant CodeBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.config.block.language != config.block.language) {
      _selectedLanguage = config.block.language;
    }
  }

  @override
  Widget build(BuildContext context) {
    final codeTheme = Theme.of(context).extension<CodeEditorTheme>()!;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: codeTheme.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: codeTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Language selector header
          CodeBlockHeader(
            selectedLanguage: _selectedLanguage ?? 'plaintext',
            onLanguageChanged: (value) {
                if (value != null) {
                  setState(() => _selectedLanguage = value);
                }},
            onCopyPressed: () =>
                Clipboard.setData(ClipboardData(text: config.block.content)),
            onDelete: config.onDelete,
          ),
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
}
