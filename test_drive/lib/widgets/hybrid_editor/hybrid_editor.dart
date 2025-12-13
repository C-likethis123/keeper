import 'package:flutter/material.dart';
import 'core/core.dart';
import 'blocks/blocks.dart';
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

  /// Placeholder text for empty editor
  final String placeholder;

  const HybridEditor({
    super.key,
    this.initialContent = '',
    this.onChanged,
    this.autofocus = false,
    this.placeholder = 'Start writing...',
  });

  @override
  State<HybridEditor> createState() => _HybridEditorState();
}

class _HybridEditorState extends State<HybridEditor> {
  late EditorState _editorState;
  late EditorTextInputManager _inputManager;
  late KeyHandler _keyHandler;
  late BlockRegistry _registry;

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

  void _onBlockContentChanged(int index, String newContent) {
    final block = _editorState.document[index];
    
    // Check for block type conversion (only for paragraphs)
    if (block.type == BlockType.paragraph) {
      final detection = _registry.detectBlockType(newContent);
      if (detection != null) {
        // Update controller text FIRST (before state change triggers rebuild)
        final controller = _inputManager.getController(index);
        controller.text = detection.remainingContent;
        controller.selection = TextSelection.collapsed(
          offset: detection.remainingContent.length,
        );
        
        // Then update block type (this triggers rebuild)
        _editorState.updateBlockType(index, detection.type);
        
        // Restore focus after rebuild
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _inputManager.focusBlock(index);
        });
        return;
      }

      // Check for code block trigger
      if (newContent.startsWith('```')) {
        final language = newContent.length > 3 ? newContent.substring(3).trim() : null;
        
        // Clear content FIRST
        final controller = _inputManager.getController(index);
        controller.text = '';
        controller.selection = const TextSelection.collapsed(offset: 0);
        
        // Then update block type
        _editorState.updateBlockType(
          index,
          BlockType.codeBlock,
          language: language?.isNotEmpty == true ? language : null,
        );
        
        // Restore focus after rebuild
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _inputManager.focusBlock(index);
        });
        return;
      }
    }

    _editorState.updateBlockContent(index, newContent);
  }

  void _onEnter(int index) {
    final controller = _inputManager.getController(index);
    final cursorPos = controller.selection.baseOffset;
    _editorState.splitBlock(index, cursorPos);
    
    // Focus the new block
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _inputManager.focusBlock(index + 1);
    });
  }

  void _onBackspaceAtStart(int index) {
    final block = _editorState.document[index];

    // If it's a non-paragraph block, convert to paragraph
    if (block.type != BlockType.paragraph && block.type != BlockType.codeBlock) {
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
    if (index > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _inputManager.focusBlock(index - 1);
      });
    }
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
    return result == KeyHandleResult.handled
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      onKeyEvent: _handleKeyEvent,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _editorState.document.length,
        itemBuilder: (context, index) => _buildBlock(index),
      ),
    );
  }

  /// Calculates the list item number for a numbered list at the given index
  int? _calculateListItemNumber(int index) {
    final block = _editorState.document[index];
    if (block.type != BlockType.numberedList) return null;
    
    // Count consecutive numbered lists before this one
    int number = 1;
    for (int i = index - 1; i >= 0; i--) {
      if (_editorState.document[i].type == BlockType.numberedList) {
        number++;
      } else {
        break;
      }
    }
    return number;
  }

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
      controller: controller,
      focusNode: focusNode,
      onContentChanged: (content) => _onBlockContentChanged(index, content),
      onEnter: () => _onEnter(index),
      onBackspaceAtStart: () => _onBackspaceAtStart(index),
      onDelete: () => _onDelete(index),
      onFocusNext: () => _onFocusNext(index),
      onFocusPrevious: () => _onFocusPrevious(index),
      listItemNumber: _calculateListItemNumber(index),
    );

    return GestureDetector(
      onTap: () => _onBlockFocus(index),
      child: _registry.build(context, config),
    );
  }
}

