import 'dart:io';

import '../models/note.dart';

/// Load all notes from the configured folders (native platforms only)
Future<List<Note>> loadNotesFromFolders(List<String> folderPaths) async {
  final List<Note> notes = [];

  for (final folderPath in folderPaths) {
    final directory = Directory(folderPath);
    if (!await directory.exists()) {
      continue;
    }

    await for (final entity in directory.list()) {
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
  final fileName = file.uri.pathSegments.last;
  final filePath = file.path;

  return Note.fromMarkdown(
    content,
    filePath: filePath,
    sourceFolder: sourceFolder,
    fileName: fileName,
  );
}

/// Create a new note in the specified folder
Future<Note> createNote({
  required String folderPath,
  required String title,
  required String content,
  bool isPinned = false,
}) async {
  final now = DateTime.now();
  final fileName = _sanitizeFileName(title);
  final filePath = '$folderPath/$fileName.md';

  // Ensure unique filename
  var file = File(filePath);
  var counter = 1;
  var finalPath = filePath;
  while (await file.exists()) {
    finalPath = '$folderPath/${fileName}_$counter.md';
    file = File(finalPath);
    counter++;
  }

  final note = Note(
    id: DateTime.now().millisecondsSinceEpoch.toString(),
    title: title,
    content: content,
    isPinned: isPinned,
    lastUpdated: now,
    filePath: finalPath,
    sourceFolder: folderPath,
  );

  await file.writeAsString(note.toMarkdown());
  return note;
}

/// Update an existing note
Future<Note> updateNote(Note note,
    {String? newTitle, String? newContent, bool? isPinned}) async {
  final updatedNote = Note(
    id: note.id,
    title: newTitle ?? note.title,
    content: newContent ?? note.content,
    isPinned: isPinned ?? note.isPinned,
    lastUpdated: DateTime.now(),
    filePath: note.filePath,
    sourceFolder: note.sourceFolder,
  );

  if (note.filePath != null) {
    final file = File(note.filePath!);
    await file.writeAsString(updatedNote.toMarkdown());
  }

  return updatedNote;
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

/// Sanitize a title to be used as a filename
String _sanitizeFileName(String title) {
  // Remove or replace characters that aren't allowed in filenames
  final sanitized = title
      .replaceAll(RegExp(r'[<>:"/\\|?*]'), '')
      .replaceAll(RegExp(r'\s+'), '_')
      .toLowerCase();
  return sanitized.substring(0, sanitized.length > 50 ? 50 : sanitized.length);
}


