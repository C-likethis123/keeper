import 'package:flutter/material.dart';

import '../blocks/block_registry.dart';
import '../core/editor_state.dart';
import 'input.dart';

/// Manages text input handlers for all blocks
class EditorTextInputManager {
  final EditorState editorState;
  final BlockRegistry registry;
  final Map<int, BlockTextInputHandler> _handlers = {};
  final Map<int, TextEditingController> _controllers = {};
  final Map<int, FocusNode> _focusNodes = {};

  EditorTextInputManager({required this.editorState, required this.registry});

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
