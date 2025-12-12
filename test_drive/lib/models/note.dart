class Note {
  final String id;
  final String title;
  final String content;
  final bool isPinned;
  final DateTime lastUpdated;

  const Note({
    required this.id,
    required this.title,
    required this.content,
    required this.lastUpdated,
    this.isPinned = false,
  });
}

