import 'dart:io';
import 'dart:math';

import '../models/note.dart';
import '../models/note_metadata.dart';

class NoteService {
  static final NoteService instance = NoteService._internal();
  NoteService._internal();

  factory NoteService() => instance;

  // Cache for full notes that have been loaded
  final Map<String, Note> _noteCache = {};

  /// Scan folders and return only metadata (fast)
  Future<List<NoteMetadata>> scanNotesMetadata(String folderPath) async {
    final List<NoteMetadata> metadata = [];

    final directory = Directory(folderPath);
    if (!await directory.exists()) {
      return [];
    }

    await for (final entity in directory.list(
      recursive: true,
      followLinks: false,
    )) {
      if (entity is File && entity.path.endsWith('.md')) {
        try {
          final fileName = Uri.decodeComponent(entity.uri.pathSegments.last);
          final lastModified = await entity.lastModified();

          metadata.add(
            NoteMetadata(
              filePath: entity.path,
              fileName: fileName,
              lastModified: lastModified,
              sourceFolder: folderPath,
            ),
          );
        } catch (e) {
          // Skip files that can't be accessed
          continue;
        }
      }
    }

    return metadata;
  }

  Future<List<String>> searchNotesByTitle(
    String folderPath,
    String title,
  ) async {
    List<String> results = [];
    final directory = Directory(folderPath);
    if (!await directory.exists()) {
      return [];
    }

    await for (final entity in directory.list(
      recursive: true,
      followLinks: false,
    )) {
      if (entity is File && entity.path.endsWith('.md')) {
        try {
          final fileName = Uri.decodeComponent(entity.uri.pathSegments.last);
          if (fileName.contains(title.toLowerCase())) {
            results.add(fileName);
          }
        } catch (e) {
          // Skip files that can't be accessed
          continue;
        }
      }
    }
    return results;
  }

  Future<Note?> searchNotes(String title) async {
    for (final note in _noteCache.values) {
      if (note.title.contains(title)) {
        return note;
      }
    }
    return null;
  }

  /// Load full notes for a specific page
  Future<List<Note>> loadNotesForPage(
    List<NoteMetadata> allMetadata,
    int page,
    int pageSize,
  ) async {
    final startIndex = page * pageSize;
    final endIndex = min(startIndex + pageSize, allMetadata.length);

    if (startIndex >= allMetadata.length) {
      return [];
    }

    final pageMetadata = allMetadata.sublist(startIndex, endIndex);
    final List<Note> notes = [];

    for (final meta in pageMetadata) {
      // Check cache first
      if (_noteCache.containsKey(meta.filePath)) {
        notes.add(_noteCache[meta.filePath]!);
        continue;
      }

      // Load from file
      try {
        final file = File(meta.filePath);
        final note = await _loadNoteFromFile(file, meta.sourceFolder);
        if (note != null) {
          _noteCache[meta.filePath] = note;
          notes.add(note);
        }
      } catch (e) {
        // Skip files that can't be read
        continue;
      }
    }

    return notes;
  }

  /// Load a single note from a markdown file
  Future<Note?> _loadNoteFromFile(File file, String sourceFolder) async {
    final content = await file.readAsString();
    final fileName = Uri.decodeComponent(file.uri.pathSegments.last);
    final filePath = file.path;
    final lastUpdated = await file.lastModified();

    return Note.fromMarkdown(
      content,
      filePath: filePath,
      sourceFolder: sourceFolder,
      fileName: fileName,
      lastUpdated: lastUpdated,
    );
  }

  /// Save a note (create if new, update if existing)
  Future<Note> saveNote({
    required String folderPath,
    required String title,
    required String content,
    required bool isPinned,
    Note? note,
  }) async {
    final now = DateTime.now();
    final id = note?.id ?? now.millisecondsSinceEpoch.toString();

    final fileName = _sanitizeFileName(title);
    final desiredPath = '$folderPath/$fileName.md';

    String finalPath = desiredPath;
    var counter = 1;
    var file = File(finalPath);

    final existingCanonicalPath = note?.filePath != null
        ? File(note!.filePath!).absolute.path
        : null;

    while (await file.exists()) {
      final currentCanonicalPath = file.absolute.path;

      if (existingCanonicalPath != null &&
          currentCanonicalPath == existingCanonicalPath) {
        break;
      }

      finalPath = '$folderPath/${fileName}_$counter.md';
      file = File(finalPath);
      counter++;
    }

    if (note != null && note.filePath != null && note.filePath != finalPath) {
      final oldFile = File(note.filePath!);
      if (await oldFile.exists()) {
        await oldFile.delete();
        // Remove from cache
        _noteCache.remove(note.filePath);
      }
    }

    final savedNote = Note(
      id: id,
      title: title,
      content: content,
      isPinned: isPinned,
      lastUpdated: now,
      filePath: finalPath,
      sourceFolder: folderPath,
    );

    file = File(finalPath);
    await file.writeAsString(savedNote.toMarkdown());

    // Update cache
    _noteCache[finalPath] = savedNote;

    return savedNote;
  }

  /// Delete a note
  Future<bool> deleteNote(Note note) async {
    if (note.filePath == null) {
      return false;
    }

    final file = File(note.filePath!);
    if (await file.exists()) {
      await file.delete();
      // Remove from cache
      _noteCache.remove(note.filePath);
      return true;
    }
    return false;
  }

  /// Clear the note cache
  void clearCache() {
    _noteCache.clear();
  }

  /// Sanitize a title to be used as a filename
  String _sanitizeFileName(String title) {
    const problematicChars = '<>"/\\|?*:';
    var sanitized = title;
    for (final char in problematicChars.split('')) {
      sanitized = sanitized.replaceAll(char, Uri.encodeComponent(char));
    }
    sanitized = sanitized.trim();
    return sanitized.substring(0, min(sanitized.length, 128));
  }
}
