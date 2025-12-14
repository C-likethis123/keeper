import 'package:flutter/material.dart';

import '../models/note.dart';
import 'notes_grid.dart';

class NotesSection extends StatelessWidget {
  final String title;
  final IconData? icon;
  final List<Note> notes;
  final void Function(Note note)? onNoteTap;
  final void Function(Note note)? onPinToggle;
  final void Function(Note note)? onDelete;

  const NotesSection({
    super.key,
    required this.title,
    required this.notes,
    this.icon,
    this.onNoteTap,
    this.onPinToggle,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    if (notes.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Row(
            spacing: 8,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 16,
                  color: colorScheme.onSurfaceVariant,
                ),
              ],
              Text(
                title,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ],
          ),
        ),
        NotesGrid(
          notes: notes,
          onNoteTap: onNoteTap,
          onPinToggle: onPinToggle,
          onDelete: onDelete,
        ),
      ],
    );
  }
}
