import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/screens/note_editor_screen.dart';
import 'package:test_drive/services/note_service.dart';
import 'package:test_drive/services/settings_service.dart';
import 'package:test_drive/widgets/code_block_widget/code_block_widget.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/math_block_widget.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/core.dart';
import 'block_config.dart';
import 'inline_markdown_renderer.dart';
import 'list_marker.dart';

class EditorBlockWidget extends StatefulWidget {
  final BlockConfig config;

  const EditorBlockWidget({super.key, required this.config});

  @override
  State<EditorBlockWidget> createState() => _EditorBlockWidgetState();
}

class _EditorBlockWidgetState extends State<EditorBlockWidget> {
  bool _showFormatted = true;
  final NoteService _noteService = NoteService();
  BlockConfig get config => widget.config;
  SettingsService get _settings => SettingsService.instance;

  @override
  void initState() {
    super.initState();
    config.focusNode.addListener(_onFocusChange);
    _showFormatted = !config.focusNode.hasFocus;
  }

  @override
  void didUpdateWidget(covariant EditorBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.config.focusNode != config.focusNode) {
      oldWidget.config.focusNode.removeListener(_onFocusChange);
      config.focusNode.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    config.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    if (!mounted) return;
    setState(() {
      _showFormatted = !config.focusNode.hasFocus;
    });
  }

  TextStyle _editorStyle(BuildContext context) {
    final theme = Theme.of(context);

    return switch (config.block.type) {
      BlockType.heading1 => theme.textTheme.headlineLarge!,
      BlockType.heading2 => theme.textTheme.headlineMedium!,
      BlockType.heading3 => theme.textTheme.headlineSmall!,
      _ => theme.textTheme.bodyLarge!,
    };
  }

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final selection = config.controller.selection;

    if (event.logicalKey == LogicalKeyboardKey.tab) {
      if (HardwareKeyboard.instance.isShiftPressed) {
        config.onTabReverse();
      } else {
        config.onTab();
      }
      return KeyEventResult.handled;
    }

    // BACKSPACE → remove style
    // onDelete is not used?
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      if (config.hasBlockSelection) {
        config.deleteSelectedBlocks();
        return KeyEventResult.handled;
      } else {
        final atStart = selection.isCollapsed && selection.baseOffset == 0;

        if (atStart) {
          config.onBackspaceAtStart();
          return KeyEventResult.handled;
        }
      }
    }

    // ENTER → split / new block
    if (event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      config.onEnter();
      return KeyEventResult.handled;
    }

    // arrows
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      config.onFocusPrevious?.call();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      config.onFocusNext?.call();
      return KeyEventResult.handled;
    }

    // spaces
    if (event.logicalKey == LogicalKeyboardKey.space) {
      config.onSpace.call();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: config.isBlockSelected
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
            : null,
      ),
      child: _buildBlock(context),
    );
  }

  Widget _buildBlock(BuildContext context) {
    final textStyle = _editorStyle(context);

    final isCodeBlock = config.block.type == BlockType.codeBlock;
    if (isCodeBlock) {
      return CodeBlockWidget(config: config);
    }
    final isMathBlock = config.block.type == BlockType.mathBlock;
    if (isMathBlock) {
      return MathBlockWidget(config: config);
    }

    final isList =
        config.block.type == BlockType.bulletList ||
        config.block.type == BlockType.numberedList;

    return Padding(
      padding: EdgeInsets.only(left: isList ? 8 : 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isList)
            ListMarker(
              type: config.block.type,
              listLevel: config.block.listLevel,
              listItemNumber: config.listItemNumber ?? 1,
            ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                setState(() => _showFormatted = false);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  config.focusNode.requestFocus();
                });
              },
              child: Stack(
                alignment: Alignment.topLeft,
                children: [
                  // Formatted markdown view
                  if (_showFormatted)
                    InlineMarkdownRenderer(
                      text: config.block.content,
                      style: textStyle,
                      onTap: (url) async {
                        // Only open link on Cmd/Ctrl + click
                        final isCmdPressed =
                            HardwareKeyboard.instance.isMetaPressed;
                        if (isCmdPressed) {
                          if (url.startsWith('http')) {
                            // launch external link
                            launchUrl(Uri.parse(url));
                          } else {
                            // search and open note within editor
                            final note = await _noteService.loadNoteFromFile(
                              File(_settings.folder! + '/' + _noteService.sanitizeFileName(url)),
                              _settings.folder!,
                            );
                            if (note != null && context.mounted) {
                              // open note within editor
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => NoteEditorScreen(
                                    existingNote: note,
                                    folderPath: note.sourceFolder ?? '',
                                  ),
                                ),
                              );
                            }
                          }
                        } else {
                          // Focus editor on normal click
                          setState(() => _showFormatted = false);
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            config.focusNode.requestFocus();
                          });
                        }
                      },
                    ),

                  // Editable text (disabled when formatted view is active)
                  IgnorePointer(
                    ignoring: _showFormatted,
                    child: Focus(
                      onKeyEvent: _onKeyEvent,
                      child: TextField(
                        controller: config.controller,
                        focusNode: config.focusNode,
                        maxLines: null,
                        style: textStyle.copyWith(
                          color: _showFormatted
                              ? Colors.transparent
                              : textStyle.color,
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                        ),
                        onChanged: config.onContentChanged,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
