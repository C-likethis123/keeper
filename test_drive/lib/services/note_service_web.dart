import '../models/note.dart';

/// Stub implementations for web platform
/// File system access is not supported on web

Future<List<Note>> loadNotesFromFolders(List<String> folderPaths) async {
  // Not supported on web
  return [];
}

Future<Note> createNote({
  required String folderPath,
  required String title,
  required String content,
  bool isPinned = false,
}) async {
  throw UnsupportedError('File system access not supported on web');
}

Future<Note> updateNote(Note note,
    {String? newTitle, String? newContent, bool? isPinned}) async {
  throw UnsupportedError('File system access not supported on web');
}

Future<bool> deleteNote(Note note) async {
  throw UnsupportedError('File system access not supported on web');
}


