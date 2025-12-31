import 'dart:io';
import 'package:pasteboard/pasteboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:test_drive/models/paste_payload.dart';
import 'package:test_drive/screens/note_editor_screen.dart';
import 'package:test_drive/services/note_service.dart';
import 'package:test_drive/services/settings_service.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/image_block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/math_block_builder.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_controller.dart';
import 'package:test_drive/widgets/hybrid_editor/wikilinks/wiki_link_overlay.dart';
import 'package:url_launcher/url_launcher.dart';
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
  final String initialContent;
  final ValueChanged<String>? onChanged;
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
  late final EditorState _editorState;
  late final EditorTextInputManager _inputManager;
  late final KeyHandler _keyHandler;
  late final BlockRegistry _registry;

  late final OverlayPortalController _wikiPortalController;
  late final WikiLinkController _wikiLinkController;

  final Map<int, LayerLink> _blockLinks = {};

  @override
  void initState() {
    super.initState();

    _registry = BlockRegistry.instance;
    _registerBlockBuilders();

    _editorState = EditorState(
      document: Document.fromMarkdown(widget.initialContent),
    )..addListener(_onEditorStateChanged);

    _inputManager = EditorTextInputManager(
      editorState: _editorState,
      registry: _registry,
    );

    _keyHandler = KeyHandler();

    _wikiPortalController = OverlayPortalController();
    _wikiLinkController = WikiLinkController()
      ..addListener(_onWikiStateChanged);

    if (widget.autofocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(0);
      });
    }
  }

  @override
  void dispose() {
    _wikiLinkController.removeListener(_onWikiStateChanged);
    _wikiLinkController.dispose();
    _editorState.dispose();
    _inputManager.dispose();
    super.dispose();
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
      ImageBlockBuilder(),
    ]);
  }

  void _onEditorStateChanged() {
    _inputManager.syncWithDocument();
    widget.onChanged?.call(_editorState.toMarkdown());
    setState(() {});
  }

  // ─────────────────────────────────────────────
  // 🔑 SINGLE KEY ENTRY POINT
  // ─────────────────────────────────────────────
  KeyEventResult _handleKeyEvent(FocusNode _, KeyEvent event) {
    if (event is! KeyDownEvent) {
      return KeyEventResult.ignored;
    }

    // 1. Wiki overlay gets first priority when active
    if (_wikiLinkController.shouldShowOverlay) {
      print('wiki overlay');
      final result = _handleWikiOverlayKeys(event);
      if (result == KeyEventResult.handled) {
        return result;
      }
    }

    // 2. Then existing block → editor → global routing
    final focusedIndex = _editorState.focusedBlockIndex;
    if (focusedIndex == null) {
      if (_editorState.hasBlockSelection) {
        print('global keys');
        return _handleGlobalKeys(event);
      }
      return KeyEventResult.ignored;
    }
    final block = _editorState.document[focusedIndex];
    final builder = _registry.getBuilder(block.type);

    final config = _buildConfigForIndex(focusedIndex);

    return _routeKeyEvent(builder: builder, config: config, event: event);
  }

  /// Handles keyboard events for the wiki link overlay
  KeyEventResult _handleWikiOverlayKeys(KeyEvent event) {
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      _wikiLinkController.selectNext();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      _wikiLinkController.selectPrevious();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.enter) {
      final link = _wikiLinkController.selectedResult;
      if (link != null) {
        _onWikiSelect(link);
      }
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      _wikiLinkController.cancel();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  void _onSpace(int index) {
    final newContent = _editorState.document[index].content;
    final detection = _registry.detectBlockType(newContent);
    // print('detection: $detection');
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

  Future<String> _saveImage(Uint8List bytes) async {
    final folder = SettingsService.instance.folder!;
    final imagesDir = Directory('$folder/.images');

    if (!imagesDir.existsSync()) {
      imagesDir.createSync(recursive: true);
    }

    final filename = 'img_${DateTime.now().millisecondsSinceEpoch}.png';

    final file = File('${imagesDir.path}/$filename');
    await file.writeAsBytes(bytes);

    return file.path;
  }

  Future<void> _handlePaste(int index) async {
    final clipboardData = await Clipboard.getData(Clipboard.kTextPlain);

    // TEXT → normal paste
    if (clipboardData?.text != null) {
      final controller = _inputManager.getController(index);
      _editorState.pasteText(
        blockIndex: index,
        controller: controller,
        payload: PastePayload.text(clipboardData!.text!),
        saveImage: _saveImage,
      );
      return;
    }
    // IMAGE → custom path
    final imageBytes = await Pasteboard.image;
    if (imageBytes == null) return;
    final imagePath = await _saveImage(imageBytes);

    _editorState.insertBlockAfter(index, BlockNode.image(path: imagePath));
  }

  void _onTap(int index, String url) async {
    final isCmdPressed = HardwareKeyboard.instance.isMetaPressed;
    if (isCmdPressed) {
      if (url.startsWith('http')) {
        launchUrl(Uri.parse(url));
      } else {
        final note = await NoteService.instance.loadNoteFromFile(
          File('${SettingsService.instance.folder!}/$url'),
          SettingsService.instance.folder!,
        );
        if (note != null && context.mounted) {
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
      final focusNode = _inputManager.getFocusNode(index);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        focusNode.requestFocus();
      });
    }
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

  // ─────────────────────────────────────────────
  // 📎 Wiki Link Overlay (editor-owned)
  // ─────────────────────────────────────────────

  /// Called when wiki controller state changes to show/hide overlay
  void _onWikiStateChanged() {
    if (_wikiLinkController.shouldShowOverlay) {
      if (!_wikiPortalController.isShowing) {
        _wikiPortalController.show();
      }
    } else {
      if (_wikiPortalController.isShowing) {
        _wikiPortalController.hide();
      }
    }
    // Rebuild to update overlay position/content
    setState(() {});
  }

  /// Called by blocks when they detect [[ trigger
  void _onWikiTriggerStart(int blockIndex, int startOffset) {
    // Only start if not already active, or if active for a different block
    if (!_wikiLinkController.isActiveFor(blockIndex)) {
      _wikiLinkController.start(
        blockIndex: blockIndex,
        startOffset: startOffset,
      );
    }
  }

  /// Called by blocks to update wiki query as user types
  void _onWikiQueryUpdate(int blockIndex, String text, int caretOffset) {
    if (!_wikiLinkController.isActive) return;

    // Update block index if it changed (e.g., block type conversion)
    if (_wikiLinkController.session!.blockIndex != blockIndex) {
      _wikiLinkController.updateBlockIndex(blockIndex);
    }

    _wikiLinkController.updateQueryFromText(
      text: text,
      caretOffset: caretOffset,
      search: (query) => NoteService.instance.searchNotesByTitle(
        SettingsService.instance.folder!,
        query,
      ),
    );
  }

  /// Called when wiki session should end
  void _onWikiTriggerEnd() {
    _wikiLinkController.end();
  }

  /// Called when user selects a wiki link from overlay
  void _onWikiSelect(String link) {
    final session = _wikiLinkController.session;
    if (session == null) return;

    final blockIndex = session.blockIndex;
    final controller = _inputManager.getController(blockIndex);
    final caret = controller.selection.baseOffset;
    final text = controller.text;

    final newText = text.replaceRange(session.startOffset, caret, '[[$link]]');

    controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: session.startOffset + link.length + 4,
      ),
    );

    _wikiLinkController.end();
    _editorState.updateBlockContent(blockIndex, newText);
  }

  /// Builds the wiki link overlay widget anchored to the active block
  Widget _buildWikiOverlay(BuildContext context) {
    final blockIndex = _wikiLinkController.session?.blockIndex;
    if (blockIndex == null) return const SizedBox.shrink();

    final link = _blockLinks[blockIndex];
    if (link == null) return const SizedBox.shrink();

    return CompositedTransformFollower(
      link: link,
      targetAnchor: Alignment.bottomLeft,
      followerAnchor: Alignment.topLeft,
      child: WikiLinkOverlay(
        results: _wikiLinkController.results,
        selectedIndex: _wikiLinkController.selectedIndex,
        onSelect: _onWikiSelect,
      ),
    );
  }

  // ─────────────────────────────────────────────
  // 🧭 ROUTER (block → editor → global)
  // ─────────────────────────────────────────────
  KeyEventResult _routeKeyEvent({
    required BlockBuilder builder,
    required BlockConfig config,
    required KeyEvent event,
  }) {
    final blockResult = builder.canHandleKeyEvent
        ? builder.handleKeyEvent(config, event)
        : KeyEventResult.ignored;

    if (blockResult == KeyEventResult.handled) {
      print('blockResult: handled in block');
      return KeyEventResult.handled;
    }

    final editorResult = _handleEditorKeys(config, event);
    if (editorResult == KeyEventResult.handled) {
      print('editorResult: handled in editor');
      return KeyEventResult.handled;
    }

    final globalResult = _handleGlobalKeys(event);
    if (globalResult == KeyEventResult.handled) {
      print('globalResult: handled in global');
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  bool _isAtFirstLine(String text, int cursor) {
    return !text.substring(0, cursor).contains('\n');
  }

  bool _isAtLastLine(String text, int cursor) {
    return !text.substring(cursor).contains('\n');
  }

  // ─────────────────────────────────────────────
  // ✏️ Editor-level keys
  // ─────────────────────────────────────────────
  KeyEventResult _handleEditorKeys(BlockConfig config, KeyEvent event) {
    final index = config.index;
    final controller = config.controller;
    final text = controller.text;
    final cursor = controller.selection.baseOffset;

    if (event.logicalKey == LogicalKeyboardKey.enter) {
      _onEnter(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.backspace &&
        controller.selection.isCollapsed &&
        controller.selection.baseOffset == 0) {
      _onBackspaceAtStart(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowDown && _isAtLastLine(text, cursor)) {
      _onFocusNext(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowUp && _isAtFirstLine(text, cursor)) {
      _onFocusPrevious(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.tab &&
        HardwareKeyboard.instance.isShiftPressed) {
      _onTabReverse(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.tab) {
      _onTab(index);
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.space) {
      _onSpace(index);
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  // ─────────────────────────────────────────────
  // 🌍 Global keys
  // ─────────────────────────────────────────────
  KeyEventResult _handleGlobalKeys(KeyEvent event) {
    final result = _keyHandler.handle(event, _editorState);
    return result == KeyHandleResult.handled
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }

  // ─────────────────────────────────────────────
  // 🧱 Block builder
  // ─────────────────────────────────────────────
  Widget _buildBlock(int index) {
    final block = _editorState.document[index];
    final builder = _registry.getBuilder(block.type);

    _blockLinks[index] ??= LayerLink();

    final config = _buildConfigForIndex(index);

    return CompositedTransformTarget(
      link: _blockLinks[index]!,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => _editorState.setFocusedBlock(index),
        child: EditorBlockWidget(
          config: config,
          formattedView: builder.build(context, config),
          editableText: builder.editableText(context, config),
          blockConfiguration: builder.blockConfiguration(context, config),
        ),
      ),
    );
  }

  BlockConfig _buildConfigForIndex(int index) {
    return BlockConfig(
      index: index,
      block: _editorState.document[index],
      isFocused: _editorState.focusedBlockIndex == index,
      isBlockSelected: _editorState.blockSelection?.contains(index) ?? false,
      hasBlockSelection: _editorState.hasBlockSelection,
      controller: _inputManager.getController(index),
      focusNode: _inputManager.getFocusNode(index),
      deleteSelectedBlocks: _editorState.deleteSelectedBlocks,
      onContentChanged: (c) => _editorState.updateBlockContent(index, c),
      onSpace: () => _onSpace(index),
      onEnter: () => _onEnter(index),
      onBackspaceAtStart: () => _onBackspaceAtStart(index),
      onDelete: () => _onDelete(index),
      onTab: () => _onTab(index),
      onTabReverse: () => _onTabReverse(index),
      onFocusNext: () => _onFocusNext(index),
      onFocusPrevious: () => _onFocusPrevious(index),
      onPaste: () => _handlePaste(index),
      onTap: (url) => _onTap(index, url),
      listItemNumber: _calculateListItemNumber(index),
      onWikiTriggerStart: (startOffset) =>
          _onWikiTriggerStart(index, startOffset),
      onWikiQueryUpdate: (query, caret) => _onWikiQueryUpdate(
        index,
        _inputManager.getController(index).text,
        caret,
      ),
      onWikiTriggerEnd: _onWikiTriggerEnd,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: OverlayPortal(
        controller: _wikiPortalController,
        overlayChildBuilder: _buildWikiOverlay,
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: _editorState.document.length,
          itemBuilder: (_, index) => _buildBlock(index),
        ),
      ),
    );
  }
}
