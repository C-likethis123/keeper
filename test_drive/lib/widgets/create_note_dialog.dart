import 'package:flutter/material.dart';

import 'app_text_field.dart';

class CreateNoteDialog extends StatefulWidget {
  const CreateNoteDialog({super.key});

  @override
  State<CreateNoteDialog> createState() => _CreateNoteDialogState();
}

class _CreateNoteDialogState extends State<CreateNoteDialog> {
  String _title = '';
  String _content = '';
  bool _isPinned = false;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return AlertDialog(
      title: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('New Note'),
          IconButton(
            onPressed: () => setState(() => _isPinned = !_isPinned),
            icon: Icon(
              _isPinned ? Icons.push_pin : Icons.push_pin_outlined,
              color: _isPinned ? colorScheme.primary : colorScheme.onSurfaceVariant,
            ),
            tooltip: _isPinned ? 'Unpin note' : 'Pin note',
          ),
        ],
      ),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppTextField(
              labelText: 'Title',
              autofocus: true,
              onChanged: (value) => _title = value,
            ),
            const SizedBox(height: 16),
            AppTextField(
              labelText: 'Content',
              maxLines: 5,
              onChanged: (value) => _content = value,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            if (_title.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Please enter a title'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
              return;
            }
            Navigator.pop(context, {
              'title': _title,
              'content': _content,
              'isPinned': _isPinned,
            });
          },
          child: const Text('Create'),
        ),
      ],
    );
  }
}
