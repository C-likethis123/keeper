import 'package:flutter/material.dart';
import 'block_config.dart';
import '../core/block_node.dart';

/// Abstract base class for block builders
abstract class BlockBuilder {
  /// The block type this builder handles
  BlockType get type;

  /// Builds the widget for this block type
  Widget build(BuildContext context, BlockConfig config);

  Widget Function(bool isFormatted) editableText(
    BuildContext context,
    BlockConfig config,
  );

  Widget Function(Widget child) blockConfiguration(
    BuildContext context,
    BlockConfig config,
  ) {
    return (child) => Padding(
      padding: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  config.focusNode.requestFocus();
                });
              },
              child: child,
            ),
          ),
        ],
      ),
    );
  }

  /// Returns the prefix that triggers this block type (e.g., "# " for heading1)
  RegExp? get triggerPrefix => null;

  /// Returns the markdown prefix for this block type
  String get markdownPrefix;

  bool get canHandleKeyEvent => false;

  // TODO: figure this out
  KeyEventResult handleKeyEvent(BlockConfig config, KeyEvent event) =>
      KeyEventResult.ignored;
}
