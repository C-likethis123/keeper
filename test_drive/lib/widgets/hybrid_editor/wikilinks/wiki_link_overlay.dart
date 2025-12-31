import 'package:flutter/material.dart';

class WikiLinkOverlay extends StatelessWidget {
  final List<String> results;
  final int selectedIndex;
  final ValueChanged<String> onSelect;

  const WikiLinkOverlay({
    super.key,
    required this.results,
    required this.selectedIndex,
    required this.onSelect,
  });

  static const double _maxHeight = 200;
  static const double _itemHeight = 40;

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);

    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(8),
      color: theme.colorScheme.surface,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: _maxHeight, maxWidth: 200),
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 4),
          itemExtent: _itemHeight,
          itemCount: results.length,
          itemBuilder: (context, index) {
            final title = results[index];
            final isSelected = index == selectedIndex;
            return InkWell(
              onTap: () => onSelect(title),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: isSelected
                      ? theme.colorScheme.primary.withValues(alpha: 0.1)
                      : null,
                ),
                child: Text(
                  title,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: isSelected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurface,
                    fontWeight: isSelected
                        ? FontWeight.w600
                        : FontWeight.normal,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

// class _WikiLinkOverlayState extends State<WikiLinkOverlay> {
//   String? _query;
//   Offset _caretOffset = Offset.zero;

//   @override
//   void initState() {
//     super.initState();
//     widget.controller.addListener(_onTextChanged);
//     widget.focusNode.addListener(_onFocusChanged);
//   }

//   @override
//   void dispose() {
//     widget.controller.removeListener(_onTextChanged);
//     widget.focusNode.removeListener(_onFocusChanged);
//     super.dispose();
//   }

//   void _onFocusChanged() {
//     if (!widget.focusNode.hasFocus) {
//       _hide();
//     }
//   }

//   void _onTextChanged() {
//     if (!widget.focusNode.hasFocus) return;

//     final selection = widget.controller.selection;
//     if (!selection.isCollapsed) {
//       _hide();
//       return;
//     }

//     final text = widget.controller.text;
//     final cursor = selection.baseOffset;
//     if (cursor < 2) {
//       _hide();
//       return;
//     }

//     final beforeCursor = text.substring(0, cursor);
//     final match = RegExp(r'\[\[([^\]]*)$').firstMatch(beforeCursor);

//     if (match == null) {
//       _hide();
//       return;
//     }

//     _query = match.group(1);
//     _caretOffset = _calculateCaretOffset(selection);

//     setState(() {});
//   }

//   void _hide() {
//     if (_query != null) {
//       setState(() => _query = null);
//     }
//   }

//   Offset _calculateCaretOffset(TextSelection selection) {
//     final editableState = widget.editableKey.currentState;
//     if (editableState == null) return Offset.zero;

//     final renderEditable = editableState.renderEditable;
//     final caretRect = renderEditable.getLocalRectForCaret(selection.extent);

//     return caretRect.bottomLeft;
//   }

//   @override
//   Widget build(BuildContext context) {
//     if (_query == null || _query!.isEmpty) {
//       return const SizedBox.shrink();
//     }

//     final suggestions = _mockSearch(_query!);
//     if (suggestions.isEmpty) {
//       return const SizedBox.shrink();
//     }

//     return Positioned(
//       left: _caretOffset.dx,
//       top: _caretOffset.dy,
//       child: Material(
//         elevation: 8,
//         borderRadius: BorderRadius.circular(8),
//         child: ConstrainedBox(
//           constraints: BoxConstraints(
//             maxHeight: (40 * suggestions.length).toDouble(),
//             maxWidth: 200,
//           ),
//           child: ListView.builder(
//             padding: const EdgeInsets.symmetric(vertical: 4),
//             itemExtent: 40,
//             itemCount: suggestions.length,
//             shrinkWrap: true,
//             itemBuilder: (context, index) {
//               return ListTile(
//                 dense: true,
//                 title: Text(suggestions[index]),
//                 onTap: () {
//                   widget.onLinkSelected(suggestions[index]);
//                   _hide();
//                 },
//               );
//             },
//           ),
//         ),
//       ),
//     );
//   }

//   List<String> _mockSearch(String query) {
//     const pages = [
//       'Flutter',
//       'Dart',
//       'Widgets',
//       'Hybrid Editor',
//       'Wiki Links',
//       'Code Block',
//     ];

//     return pages
//         .where((p) => p.toLowerCase().contains(query.toLowerCase()))
//         .toList();
//   }
// }
