import 'package:flutter/material.dart';
import '../core/core.dart';
import 'types.dart';

/// Configuration for a block widget
class BlockConfig {
  final int index;
  final BlockNode block;
  final bool isFocused;
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
  
  /// For numbered lists: the number to display (1, 2, 3, etc.)
  final int? listItemNumber;

  const BlockConfig({
    required this.index,
    required this.block,
    required this.isFocused,
    required this.controller,
    required this.focusNode,
    required this.onContentChanged,
    required this.onEnter,
    required this.onSpace,
    required this.onBackspaceAtStart,
    required this.onDelete,
    required this.onTab,
    required this.onTabReverse,
    this.onFocusNext,
    this.onFocusPrevious,
    this.listItemNumber,
  });
}
