import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/services/note_service.dart';
import 'package:test_drive/services/settings_service.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/math_block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_controller.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_dropdown.dart';
import 'blocks/editor_block.dart';
import 'core/core.dart';
import 'blocks/blocks.dart';
import 'input/editor_text_input_manager.dart';
import 'input/input.dart';

/// A hybrid markdown/code editor widget
///
/// Features:
/// - Block-based editing with markdown support
/// - Inline markdown formatting (bold, italic, code, links)
/// - Full code editor experience in code blocks
/// - Undo/redo support
/// - Keyboard shortcuts
class HybridEditor extends StatefulWidget {
  /// Initial content as markdown
  final String initialContent;

  /// Called when content changes
  final ValueChanged<String>? onChanged;

  /// Whether to autofocus on mount
  final bool autofocus;

  const HybridEditor({
    super.key,
    this.initialContent = '',
    this.onChanged,
    this.autofocus = false,
  });

  @override
  State<HybridEditor> createState() => _HybridEditorState();
}

class _HybridEditorState extends State<HybridEditor> {
  late EditorState _editorState;
  late EditorTextInputManager _inputManager;
  late KeyHandler _keyHandler;
  late BlockRegistry _registry;
  late final OverlayPortalController _wikiPortalController;
  late final WikiLinkController _wikiLinkController;
  late final SettingsService _settingsService = SettingsService.instance;

  final Map<int, LayerLink> _blockLinks = {}; // anchor for each block

  @override
  void initState() {
    super.initState();

    // Initialize block registry
    _registry = BlockRegistry.instance;
    _registerBlockBuilders();

    // Initialize editor state
    _editorState = EditorState(
      document: Document.fromMarkdown(widget.initialContent),
    );
    _editorState.addListener(_onEditorStateChanged);
    // Initialize input manager
    _inputManager = EditorTextInputManager(
      editorState: _editorState,
      registry: _registry,
    );

    // Initialize key handler
    _keyHandler = KeyHandler();

    // Autofocus first block
    if (widget.autofocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(0);
      });
    }

    _wikiPortalController = OverlayPortalController();
    _wikiLinkController = WikiLinkController();
  }

  void _registerBlockBuilders() {
    _registry.registerAll([
      ParagraphBlockBuilder(),
      Heading1BlockBuilder(),
      Heading2BlockBuilder(),
      Heading3BlockBuilder(),
      BulletListBlockBuilder(),
      NumberedListBlockBuilder(),
      CodeBlockBuilder(),
      MathBlockBuilder(),
    ]);
  }

  @override
  void dispose() {
    _editorState.removeListener(_onEditorStateChanged);
    _editorState.dispose();
    _inputManager.dispose();
    super.dispose();
  }

  void _onEditorStateChanged() {
    _inputManager.syncWithDocument();
    widget.onChanged?.call(_editorState.toMarkdown());
    setState(() {});
  }

  void _onBlockFocus(int index) {
    _editorState.setFocusedBlock(index);
  }

  bool _isWikiTrigger(TextEditingController c) {
    final text = c.text;
    final cursor = c.selection.baseOffset;
    if (cursor < 2 || cursor > text.length) return false;
    return text.substring(cursor - 2, cursor) == '[[';
  }

  void _onBlockContentChanged(int index, String newContent) {
    _editorState.updateBlockContent(index, newContent);

    final controller = _inputManager.getController(index);
    final caret = controller.selection.baseOffset;

    if (!_wikiLinkController.isActive && _isWikiTrigger(controller)) {
      _wikiLinkController.start(blockIndex: index, startOffset: caret - 2);
      _wikiPortalController.show();
      setState(() {}); // trigger overlay rebuild
      return;
    }

    if (_wikiLinkController.isActive &&
        _wikiLinkController.session!.blockIndex == index) {
      _wikiLinkController.updateQueryFromText(
        text: controller.text,
        caretOffset: caret,
        search: (query) => NoteService.instance.searchNotesByTitle(
          _settingsService.folder!,
          query,
        ),
      );

      if (!_wikiLinkController.isActive) {
        _wikiPortalController.hide();
        setState(() {});
      }
    }
  }

  void _endWikiMode() {
    _wikiLinkController.end();
    _wikiPortalController.hide();
    setState(() {});
  }

  void _insertWikiLink(String file) {
    final session = _wikiLinkController.session!;
    final blockIndex = session.blockIndex;
    final controller = _inputManager.getController(blockIndex);

    final text = controller.text;
    final caret = controller.selection.baseOffset;

    final before = text.substring(0, session.startOffset);
    final after = text.substring(caret);

    final insert = '[[$file]]';
    final newText = before + insert + after;

    _editorState.updateBlockContent(blockIndex, newText);

    controller.selection = TextSelection.collapsed(
      offset: before.length + insert.length,
    );

    _wikiLinkController.end();
    _wikiPortalController.hide();
  }

  void _onSpace(int index) {
    final newContent = _editorState.document[index].content;
    final detection = _registry.detectBlockType(newContent);
    if (detection != null) {
      _editorState.updateBlockType(
        index,
        detection.type,
        language: detection.language,
      );
      _editorState.updateBlockContent(index, detection.remainingContent);
    } else {
      _editorState.updateBlockContent(index, '$newContent ');
    }
  }

  void _onTab(int index) {
    final block = _editorState.document[index];
    final listItemNumber = _calculateListItemNumber(index);
    final canChangeToSublist = listItemNumber != null && listItemNumber > 1;
    // if it's not the first item, make this into a sublist
    if (block.isListItem && canChangeToSublist) {
      _editorState.updateBlockListLevel(index, block.listLevel + 1);
    }
  }

  void _onTabReverse(int index) {
    final block = _editorState.document[index];
    final canReverse = block.isListItem && block.listLevel > 0;
    if (canReverse) {
      _editorState.updateBlockListLevel(index, block.listLevel - 1);
    }
  }

  void _onEnter(int index) {
    final newContent = _editorState.document[index].content;
    final detection = _registry.detectBlockType(newContent);
    if (detection != null) {
      _editorState.updateBlockType(
        index,
        detection.type,
        language: detection.language,
      );
      _editorState.updateBlockContent(index, detection.remainingContent);
    } else {
      // Maybe I can do something here? If there is block type change, then I'll do that.
      final controller = _inputManager.getController(index);
      final cursorPos = controller.selection.baseOffset;
      _editorState.splitBlock(index, cursorPos);

      // Focus the new block
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(index + 1);
      });
    }
  }

  void _onBackspaceAtStart(int index) {
    final block = _editorState.document[index];

    // If it's a non-paragraph block, convert to paragraph
    if (block.type != BlockType.paragraph &&
        block.type != BlockType.codeBlock) {
      _editorState.updateBlockType(index, BlockType.paragraph);
      return;
    }

    // If it's an empty paragraph, delete and focus previous
    if (block.content.isEmpty && index > 0) {
      _editorState.deleteBlock(index);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final prevController = _inputManager.getController(index - 1);
        prevController.selection = TextSelection.collapsed(
          offset: prevController.text.length,
        );
        _inputManager.focusBlock(index - 1);
      });
      return;
    }

    // Merge with previous block
    if (index > 0) {
      _editorState.mergeWithPrevious(index);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(index - 1);
      });
    }
  }

  void _onDelete(int index) {
    _editorState.deleteBlock(index);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _inputManager.focusBlock(index > 0 ? index - 1 : 0);
    });
  }

  void _onFocusNext(int index) {
    if (index < _editorState.document.length - 1) {
      _inputManager.focusBlock(index + 1);
    } else {
      // If this is the last block (e.g., escaping from a code block), create a new paragraph
      _editorState.insertBlockAfter(index, BlockNode.paragraph());
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(index + 1);
      });
    }
  }

  void _onFocusPrevious(int index) {
    if (index > 0) {
      _inputManager.focusBlock(index - 1);
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    final result = _keyHandler.handle(event, _editorState);
    if (_wikiLinkController.isActive) {
      if (event.logicalKey == LogicalKeyboardKey.escape) {
        _wikiLinkController.cancel();
        _endWikiMode();
        return KeyEventResult.handled;
      }
      if (event.logicalKey == LogicalKeyboardKey.enter) {
        _insertWikiLink(_wikiLinkController.selectedResult!);
        return KeyEventResult.handled;
      }
      if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
        _wikiLinkController.selectNext();
        return KeyEventResult.handled;
      }
      if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
        _wikiLinkController.selectPrevious();
        return KeyEventResult.handled;
      }
    }
    return result == KeyHandleResult.handled
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return OverlayPortal(
      controller: _wikiPortalController,
      overlayChildBuilder: (context) {
        if (!_wikiLinkController.isActive) return const SizedBox.shrink();

        final blockIndex = _wikiLinkController.session!.blockIndex;
        final link = _blockLinks[blockIndex];

        if (link == null) return const SizedBox.shrink();

        double blockHeight = _wikiLinkController.results.length * 40.0;

        return CompositedTransformFollower(
          link: link,
          showWhenUnlinked: false,
          offset: Offset(0, 30), // dropdown below caret
          child: Align(
            alignment: Alignment.topLeft,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: 320,
                maxHeight: blockHeight,
              ),
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(6),
                child: WikiLinkDropdown(
                  controller: _wikiLinkController,
                  onSelect: _insertWikiLink,
                ),
              ),
            ),
          ),
        );
      },
      child: Focus(
        onKeyEvent: _handleKeyEvent,
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: _editorState.document.length,
          itemBuilder: (context, index) {
            _blockLinks[index] ??= LayerLink(); // ensure link exists
            return _buildBlock(index);
          },
        ),
      ),
    );
  }

  /// Calculates the list item number for a numbered list at the given index
  int? _calculateListItemNumber(int index) {
    final block = _editorState.document[index];
    if (block.type != BlockType.numberedList) return null;
    final listLevel = block.listLevel;
    // Count consecutive numbered lists before this one
    int number = 1;
    for (int i = index - 1; i >= 0; i--) {
      if (_editorState.document[i].type != BlockType.numberedList ||
          _editorState.document[i].listLevel < listLevel) {
        break;
      }
      if (_editorState.document[i].type == BlockType.numberedList &&
          _editorState.document[i].listLevel == listLevel) {
        number++;
      }
    }
    return number;
  }

  // it depends on the node that's being built here.
  // what is the first document that's built, vs the second document that's built?
  // everything is wrapped with a gesture detector.
  Widget _buildBlock(int index) {
    final block = _editorState.document[index];
    final isFocused = _editorState.focusedBlockIndex == index;
    final controller = _inputManager.getController(index);
    final focusNode = _inputManager.getFocusNode(index);

    // Sync controller text if needed
    if (controller.text != block.content) {
      controller.text = block.content;
    }

    final config = BlockConfig(
      index: index,
      block: block,
      isFocused: isFocused,
      isBlockSelected: _editorState.blockSelection?.contains(index) ?? false,
      hasBlockSelection: _editorState.hasBlockSelection,
      deleteSelectedBlocks: () => _editorState.deleteSelectedBlocks(),
      controller: controller,
      focusNode: focusNode,
      onContentChanged: (content) => _onBlockContentChanged(index, content),
      onSpace: () => _onSpace(index),
      onEnter: () => _onEnter(index),
      onBackspaceAtStart: () => _onBackspaceAtStart(index),
      onDelete: () => _onDelete(index),
      onTab: () => _onTab(index),
      onTabReverse: () => _onTabReverse(index),
      onFocusNext: () => _onFocusNext(index),
      onFocusPrevious: () => _onFocusPrevious(index),
      listItemNumber: _calculateListItemNumber(index),
    );

    return CompositedTransformTarget(
      link: _blockLinks[index]!,
      child: GestureDetector(
        onTap: () => _onBlockFocus(index),
        child: EditorBlockWidget(config: config),
      ),
    );
  }
}
