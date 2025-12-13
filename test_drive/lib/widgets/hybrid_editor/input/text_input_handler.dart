import 'package:flutter/material.dart';
import '../core/core.dart';
import '../blocks/block_registry.dart';

/// Handles text input for a specific block
/// 
/// This class bridges Flutter's TextInputClient with our editor state,
/// providing IME support and text input handling.
class BlockTextInputHandler {
  final EditorState editorState;
  final int blockIndex;
  final TextEditingController controller;
  final BlockRegistry registry;
  final void Function()? onEnter;
  final void Function()? onBackspaceAtStart;

  String _previousText = '';

  BlockTextInputHandler({
    required this.editorState,
    required this.blockIndex,
    required this.controller,
    required this.registry,
    this.onEnter,
    this.onBackspaceAtStart,
  }) {
    _previousText = controller.text;
  }

  /// Called when the text changes
  void onTextChanged(String newText) {
    final block = editorState.document[blockIndex];
    
    // Check for block type conversion triggers
    if (block.type == BlockType.paragraph && newText != _previousText) {
      final detection = registry.detectBlockType(newText);
      if (detection != null) {
        // Convert block type and update content
        editorState.updateBlockType(blockIndex, detection.type);
        
        // Update the text to remove the trigger prefix
        controller.text = detection.remainingContent;
        controller.selection = TextSelection.collapsed(
          offset: detection.remainingContent.length,
        );
        
        _previousText = detection.remainingContent;
        return;
      }

      // Check for code block trigger
      if (newText.startsWith('```')) {
        final language = newText.length > 3 ? newText.substring(3).trim() : null;
        editorState.updateBlockType(
          blockIndex, 
          BlockType.codeBlock,
          language: language?.isNotEmpty == true ? language : null,
        );
        controller.text = '';
        controller.selection = const TextSelection.collapsed(offset: 0);
        _previousText = '';
        return;
      }
    }

    // Regular content update
    if (newText != block.content) {
      editorState.updateBlockContent(blockIndex, newText);
    }
    
    _previousText = newText;
  }

  /// Handles enter key press
  void handleEnter() {
    if (onEnter != null) {
      onEnter!();
      return;
    }

    final selection = controller.selection;
    if (selection.isCollapsed) {
      editorState.splitBlock(blockIndex, selection.baseOffset);
    }
  }

  /// Handles backspace at the start of a block
  void handleBackspaceAtStart() {
    final block = editorState.document[blockIndex];
    
    // If block has a type other than paragraph, convert to paragraph first
    if (block.type != BlockType.paragraph && block.type != BlockType.codeBlock) {
      editorState.updateBlockType(blockIndex, BlockType.paragraph);
      return;
    }

    // If paragraph is empty, merge with previous
    if (block.content.isEmpty && blockIndex > 0) {
      onBackspaceAtStart?.call();
      return;
    }

    // If at start of non-empty paragraph, merge with previous
    if (blockIndex > 0 && controller.selection.baseOffset == 0) {
      editorState.mergeWithPrevious(blockIndex);
    }
  }

  /// Disposes resources
  void dispose() {
    // Nothing to dispose currently
  }
}

/// Manages text input handlers for all blocks
class EditorTextInputManager {
  final EditorState editorState;
  final BlockRegistry registry;
  final Map<int, BlockTextInputHandler> _handlers = {};
  final Map<int, TextEditingController> _controllers = {};
  final Map<int, FocusNode> _focusNodes = {};

  EditorTextInputManager({
    required this.editorState,
    required this.registry,
  });

  /// Gets or creates a controller for a block
  TextEditingController getController(int blockIndex) {
    if (!_controllers.containsKey(blockIndex)) {
      final block = editorState.document[blockIndex];
      _controllers[blockIndex] = TextEditingController(text: block.content);
    }
    return _controllers[blockIndex]!;
  }

  /// Gets or creates a focus node for a block
  FocusNode getFocusNode(int blockIndex) {
    if (!_focusNodes.containsKey(blockIndex)) {
      _focusNodes[blockIndex] = FocusNode();
    }
    return _focusNodes[blockIndex]!;
  }

  /// Gets or creates a handler for a block
  BlockTextInputHandler getHandler(
    int blockIndex, {
    void Function()? onEnter,
    void Function()? onBackspaceAtStart,
  }) {
    if (!_handlers.containsKey(blockIndex)) {
      _handlers[blockIndex] = BlockTextInputHandler(
        editorState: editorState,
        blockIndex: blockIndex,
        controller: getController(blockIndex),
        registry: registry,
        onEnter: onEnter,
        onBackspaceAtStart: onBackspaceAtStart,
      );
    }
    return _handlers[blockIndex]!;
  }

  /// Synchronizes controllers with document state
  void syncWithDocument() {
    final doc = editorState.document;
    
    // Remove controllers for deleted blocks
    _controllers.removeWhere((index, _) => index >= doc.length);
    _focusNodes.removeWhere((index, _) => index >= doc.length);
    _handlers.removeWhere((index, _) => index >= doc.length);

    // Update existing controllers
    for (int i = 0; i < doc.length; i++) {
      final controller = _controllers[i];
      if (controller != null && controller.text != doc[i].content) {
        controller.text = doc[i].content;
      }
    }
  }

  /// Focuses a specific block
  void focusBlock(int blockIndex) {
    final focusNode = getFocusNode(blockIndex);
    focusNode.requestFocus();
    editorState.setFocusedBlock(blockIndex);
  }

  /// Disposes all resources
  void dispose() {
    for (final handler in _handlers.values) {
      handler.dispose();
    }
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes.values) {
      focusNode.dispose();
    }
    _handlers.clear();
    _controllers.clear();
    _focusNodes.clear();
  }
}

