import 'package:flutter/material.dart';

import '../core/core.dart';
class ListMarker extends StatelessWidget {
  final BlockType type;
  final int listLevel;
  final int listItemNumber;

  const ListMarker({super.key, required this.type, required this.listLevel, required this.listItemNumber});

  @override
  Widget build(BuildContext context) {
   final theme = Theme.of(context);
   final style = theme.textTheme.bodyLarge ?? const TextStyle(fontSize: 16);

    final indent = (listLevel * 16).toDouble();
    if (type == BlockType.numberedList) {
      final number = listItemNumber;
      return Padding(
        padding: EdgeInsets.only(left: indent),
        child: SizedBox(
          width: 28,
          child: Text(
            '$number.',
            style: style.copyWith(color: theme.colorScheme.primary),
          ),
        ),
      );
    }

    if (type == BlockType.bulletList) {
      return Padding(
        padding: EdgeInsets.only(left: indent),
        child: SizedBox(
          width: 24,
          child: Align(
            alignment: Alignment.topLeft,
            child: Container(
              margin: const EdgeInsets.only(top: 8),
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      );
    }

    return const SizedBox(width: 0);
  }
}