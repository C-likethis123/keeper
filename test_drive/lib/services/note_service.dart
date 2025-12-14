import 'dart:io';
import 'dart:math';

import '../models/note.dart';

class NoteService {
  /// Load all notes from the configured folders
  Future<List<Note>> loadNotesFromFolders(List<String> folderPaths) async {
    final List<Note> notes = [];

    for (final folderPath in folderPaths) {
      final directory = Directory(folderPath);
      if (!await directory.exists()) {
        continue;
      }

      await for (final entity in directory.list()) {
        if (entity is Directory) {
          notes.addAll(await loadNotesFromFolders([entity.path]));
        }
        if (entity is File && entity.path.endsWith('.md')) {
          try {
            final note = await _loadNoteFromFile(entity, folderPath);
            if (note != null) {
              notes.add(note);
            }
          } catch (e) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    }
    return notes;
  }

  /// Load a single note from a markdown file
  Future<Note?> _loadNoteFromFile(File file, String sourceFolder) async {
    final content = await file.readAsString();
    // Decode URL-encoded filename (e.g., %3A -> :, %20 -> space)
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
  /// If the title changes, deletes the old file and creates a new one
  Future<Note> saveNote({
    required String folderPath,
    required String title,
    required String content,
    required bool isPinned,
    Note? note,
  }) async {
    final now = DateTime.now();
    final id = note?.id ?? now.millisecondsSinceEpoch.toString();

    // 1. Sanitize the title to create a valid filename
    final fileName = _sanitizeFileName(title);
    final desiredPath = '$folderPath/$fileName.md';

    // 2. Ensure unique filename by adding counter if needed
    String finalPath = desiredPath;
    var counter = 1;
    var file = File(finalPath);

    // Skip the existing note's own file when checking for conflicts
    while (await file.exists() && file.path != note?.filePath) {
      finalPath = '$folderPath/${fileName}_$counter.md';
      file = File(finalPath);
      counter++;
    }

    // 3. If updating and the file path has changed, delete the old file
    if (note != null && note.filePath != null && note.filePath != finalPath) {
      final oldFile = File(note.filePath!);
      if (await oldFile.exists()) {
        await oldFile.delete();
      }
    }

    // Create or update the note
    final savedNote = Note(
      id: id,
      title: title,
      content: content,
      isPinned: isPinned,
      lastUpdated: now,
      filePath: finalPath,
      sourceFolder: folderPath,
    );

    // Write to file
    file = File(finalPath);
    await file.writeAsString(savedNote.toMarkdown());

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
      return true;
    }
    return false;
  }

  /// Sanitize a title to be used as a filename.
  /// URL-encodes special characters that may cause issues on some file systems.
  String _sanitizeFileName(String title) {
    // Characters that are problematic across file systems (Windows especially)
    // < > " / \ | ? * : are not allowed on Windows
    const problematicChars = '<>"/\\|?*:';
    var sanitized = title;
    for (final char in problematicChars.split('')) {
      sanitized = sanitized.replaceAll(char, Uri.encodeComponent(char));
    }
    sanitized = sanitized.trim();
    return sanitized.substring(0, min(sanitized.length, 128));
  }
}
