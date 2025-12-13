import 'package:flutter/foundation.dart' show kIsWeb;

import '../models/note.dart';
import 'note_service_native.dart' if (dart.library.html) 'note_service_web.dart'
    as platform;

class NoteService {
  /// Load all notes from the configured folders
  Future<List<Note>> loadNotesFromFolders(List<String> folderPaths) async {
    if (kIsWeb) {
      // File system access not supported on web
      return [];
    }
    return platform.loadNotesFromFolders(folderPaths);
  }

  /// Create a new note in the specified folder
  Future<Note> createNote({
    required String folderPath,
    required String title,
    required String content,
    bool isPinned = false,
  }) async {
    if (kIsWeb) {
      throw UnsupportedError('File system access not supported on web');
    }
    return platform.createNote(
      folderPath: folderPath,
      title: title,
      content: content,
      isPinned: isPinned,
    );
  }

  /// Update an existing note
  Future<Note> updateNote(Note note,
      {String? newTitle, String? newContent, bool? isPinned}) async {
    if (kIsWeb) {
      throw UnsupportedError('File system access not supported on web');
    }
    return platform.updateNote(note,
        newTitle: newTitle, newContent: newContent, isPinned: isPinned);
  }

  /// Delete a note
  Future<bool> deleteNote(Note note) async {
    if (kIsWeb) {
      throw UnsupportedError('File system access not supported on web');
    }
    return platform.deleteNote(note);
  }

  /// Check if file system is supported
  bool get isSupported => !kIsWeb;
}
