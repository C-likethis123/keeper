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
        final language = newText.length > 3
            ? newText.substring(3).trim()
            : null;
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
    if (block.type != BlockType.paragraph &&
        block.type != BlockType.codeBlock) {
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
