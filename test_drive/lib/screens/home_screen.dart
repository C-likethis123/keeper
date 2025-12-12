import 'package:flutter/material.dart';

import '../models/note.dart';
import '../widgets/note_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<Note> _notes = [
    Note(
      id: '1',
      title: 'Shopping List',
      content: 'Milk, eggs, bread, butter, cheese, orange juice, apples, bananas',
      isPinned: true,
      lastUpdated: DateTime(2025, 12, 13, 10, 30),
    ),
    Note(
      id: '2',
      title: 'Meeting Notes',
      content: 'Discuss Q4 targets with the team. Review budget allocations and timeline for new product launch.',
      isPinned: true,
      lastUpdated: DateTime(2025, 12, 12, 14, 0),
    ),
    Note(
      id: '3',
      title: 'Weekend Plans',
      content: 'Saturday: Brunch with friends at 11am\nSunday: Hiking trip to the mountains',
      isPinned: true,
      lastUpdated: DateTime(2025, 12, 11, 9, 15),
    ),
    Note(
      id: '4',
      title: 'App Ideas',
      content: 'Build a habit tracker with streaks and achievements. Maybe add social features for accountability.',
      isPinned: false,
      lastUpdated: DateTime(2025, 12, 10, 16, 45),
    ),
    Note(
      id: '5',
      title: 'Book Recommendations',
      content: 'Atomic Habits, Deep Work, The Psychology of Money, Thinking Fast and Slow',
      isPinned: false,
      lastUpdated: DateTime(2025, 12, 8, 11, 20),
    ),
    Note(
      id: '6',
      title: 'Recipe: Pasta Carbonara',
      content: 'Ingredients: spaghetti, eggs, parmesan, guanciale, black pepper. Cook pasta, mix eggs with cheese, combine with hot pasta off heat.',
      isPinned: false,
      lastUpdated: DateTime(2025, 12, 5, 19, 0),
    ),
    Note(
      id: '7',
      title: 'Workout Routine',
      content: 'Monday: Chest & Triceps\nWednesday: Back & Biceps\nFriday: Legs & Shoulders\nCardio on rest days',
      isPinned: false,
      lastUpdated: DateTime(2025, 12, 1, 8, 0),
    ),
  ];

  List<Note> get _pinnedNotes {
    final pinned = _notes.where((n) => n.isPinned).toList();
    pinned.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));
    return pinned;
  }

  List<Note> get _otherNotes {
    final others = _notes.where((n) => !n.isPinned).toList();
    others.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));
    return others;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () {},
        ),
        title: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Pinned Section
          if (_pinnedNotes.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 12),
              child: Row(
                children: [
                  Icon(
                    Icons.push_pin,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Pinned',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ],
              ),
            ),
            _buildNotesGrid(_pinnedNotes),
            const SizedBox(height: 24),
          ],
          // Others Section
          if (_otherNotes.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 12),
              child: Text(
                'Others',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
            _buildNotesGrid(_otherNotes),
          ],
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        tooltip: 'Add Note',
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildNotesGrid(List<Note> notes) {
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

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

