import 'package:flutter/material.dart';
import '../core/core.dart';
import 'types.dart';

/// Configuration for a block widget
class BlockConfig {
  final int index;
  final BlockNode block;
  final bool isFocused;
  final bool isBlockSelected;
  final bool hasBlockSelection;
  final VoidCallback deleteSelectedBlocks;
  final TextEditingController controller;
  final FocusNode focusNode;
  final BlockContentCallback onContentChanged;
  final BlockCallback onEnter;
  final BlockCallback onSpace;
  final BlockCallback onBackspaceAtStart;
  final BlockCallback onDelete;
  final BlockCallback onTab;
  final BlockCallback onTabReverse;
  final VoidCallback? onFocusNext;
  final VoidCallback? onFocusPrevious;
  final VoidCallback? onPaste;
  final Function(String url) onTap;
  /// For numbered lists: the number to display (1, 2, 3, etc.)
  final int? listItemNumber;

  /// Called when block detects a wiki link trigger ([[)
  /// Reports the start offset of the trigger in the text
  final void Function(int startOffset)? onWikiTriggerStart;

  /// Called to update wiki query as user types after [[
  final void Function(String query, int caretOffset)? onWikiQueryUpdate;

  /// Called when wiki session should end (caret moved before [[, typed ]], etc.)
  final VoidCallback? onWikiTriggerEnd;

  const BlockConfig({
    required this.index,
    required this.block,
    required this.isFocused,
    required this.isBlockSelected,
    required this.hasBlockSelection,
    required this.deleteSelectedBlocks,
    required this.controller,
    required this.focusNode,
    required this.onContentChanged,
    required this.onEnter,
    required this.onSpace,
    required this.onBackspaceAtStart,
    required this.onDelete,
    required this.onTab,
    required this.onTabReverse,
    required this.onPaste,
    required this.onTap,
    this.onFocusNext,
    this.onFocusPrevious,
    this.listItemNumber,
    this.onWikiTriggerStart,
    this.onWikiQueryUpdate,
    this.onWikiTriggerEnd,
  });
}
