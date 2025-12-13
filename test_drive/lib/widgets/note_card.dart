import 'package:flutter/material.dart';

import '../models/note.dart';
import '../utils/date_utils.dart';

class NoteCard extends StatelessWidget {
  final Note note;
  final Function(Note note)? onTap;
  final Function(Note note)? onPinToggle;
  final Function(Note note)? onDelete;

  const NoteCard({
    super.key,
    required this.note,
    this.onTap,
    this.onPinToggle,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: colorScheme.outlineVariant,
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: onTap != null ? () => onTap!(note) : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title row with pin icon
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      note.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (note.isPinned)
                    IconButton(
                      onPressed: () => onPinToggle?.call(note),
                      icon: Icon(
                        Icons.push_pin,
                        size: 24,
                        color: colorScheme.primary,
                      ),
                      tooltip: 'Unpin',
                      iconSize: 24,
                      constraints: const BoxConstraints(
                        minWidth: 40,
                        minHeight: 40,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              // Content preview
              Expanded(
                child: Text(
                  note.content,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 8),
              // Bottom row: date and actions
              Row(
                children: [
                  Expanded(
                    child: Text(
                      formatRelativeDate(note.lastUpdated),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                          ),
                    ),
                  ),
                  // Action buttons
                  if (!note.isPinned)
                    IconButton(
                      onPressed: () => onPinToggle?.call(note),
                      icon: Icon(
                        Icons.push_pin_outlined,
                        size: 24,
                        color: colorScheme.onSurfaceVariant,
                      ),
                      tooltip: 'Pin',
                      iconSize: 24,
                      constraints: const BoxConstraints(
                        minWidth: 40,
                        minHeight: 40,
                      ),
                    ),
                  IconButton(
                    onPressed: () => onDelete?.call(note),
                    icon: Icon(
                      Icons.delete_outline,
                      size: 24,
                      color: colorScheme.onSurfaceVariant,
                    ),
                    tooltip: 'Delete',
                    iconSize: 24,
                    constraints: const BoxConstraints(
                      minWidth: 40,
                      minHeight: 40,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
