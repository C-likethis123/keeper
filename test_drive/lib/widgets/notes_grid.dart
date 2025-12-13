import 'package:flutter/material.dart';

import '../models/note.dart';
import 'note_card.dart';

class NotesGrid extends StatelessWidget {
  final List<Note> notes;

  const NotesGrid({super.key, required this.notes});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Responsive column count based on width
        int crossAxisCount = 2;
        if (constraints.maxWidth > 900) {
          crossAxisCount = 4;
        } else if (constraints.maxWidth > 600) {
          crossAxisCount = 3;
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1.4,
          ),
          itemCount: notes.length,
          itemBuilder: (context, index) => NoteCard(note: notes[index]),
        );
      },
    );
  }
}

