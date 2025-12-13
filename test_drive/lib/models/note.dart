class Note {
  final String id;
  final String title;
  final String content;
  final bool isPinned;
  final bool isDeleted;
  final DateTime lastUpdated;
  final String? filePath;
  final String? sourceFolder;

  const Note({
    required this.id,
    required this.title,
    required this.content,
    required this.lastUpdated,
    this.isPinned = false,
    this.isDeleted = false,
    this.filePath,
    this.sourceFolder,
  });

  /// Create a Note from a markdown file content with YAML frontmatter
  ///
  /// Expected format:
  /// ```
  /// ---
  /// title: Note Title
  /// pinned: true
  /// deleted: false
  /// date: 2025-12-13T10:30:00
  /// ---
  ///
  /// Note content here...
  /// ```
  factory Note.fromMarkdown(
    String markdown, {
    required String filePath,
    required String sourceFolder,
    required String fileName,
    required DateTime lastUpdated,
  }) {
    String title = fileName.replaceAll('.md', '');
    String content = markdown;
    bool isPinned = false;
    bool isDeleted = false;

    // Check for YAML frontmatter
    if (markdown.startsWith('---')) {
      final endIndex = markdown.indexOf('---', 3);
      if (endIndex != -1) {
        final frontmatter = markdown.substring(3, endIndex).trim();
        content = markdown.substring(endIndex + 3).trim();

        // Parse frontmatter
        for (final line in frontmatter.split('\n')) {
          final colonIndex = line.indexOf(':');
          if (colonIndex != -1) {
            final keyValuePair = line.split(':');
            final key = keyValuePair[0].trim().toLowerCase();
            final value = keyValuePair[1].trim();

            switch (key) {
              case 'title':
                title = value;
                break;
              case 'pinned':
                isPinned = value.toLowerCase() == 'true';
                break;
              case 'deleted':
                isDeleted = value.toLowerCase() == 'true';
                break;
            }
          }
        }
      }
    }

    return Note(
      id: filePath.hashCode.toString(),
      title: title,
      content: content,
      isPinned: isPinned,
      isDeleted: isDeleted,
      lastUpdated: lastUpdated,
      filePath: filePath,
      sourceFolder: sourceFolder,
    );
  }

  /// Convert this Note to markdown format with YAML frontmatter
  String toMarkdown() {
    final buffer = StringBuffer();
    buffer.writeln('---');
    buffer.writeln('title: $title');
    buffer.writeln('pinned: $isPinned');
    buffer.writeln('deleted: $isDeleted');
    buffer.writeln('date: ${lastUpdated.toIso8601String()}');
    buffer.writeln('---');
    buffer.writeln();
    buffer.writeln(content);
    return buffer.toString();
  }

  /// Create a copy with updated fields
  Note copyWith({
    String? id,
    String? title,
    String? content,
    bool? isPinned,
    bool? isDeleted,
    DateTime? lastUpdated,
    String? filePath,
    String? sourceFolder,
  }) {
    return Note(
      id: id ?? this.id,
      title: title ?? this.title,
      content: content ?? this.content,
      isPinned: isPinned ?? this.isPinned,
      isDeleted: isDeleted ?? this.isDeleted,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      filePath: filePath ?? this.filePath,
      sourceFolder: sourceFolder ?? this.sourceFolder,
    );
  }
}
