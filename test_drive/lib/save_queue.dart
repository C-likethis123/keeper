import 'dart:async';
import 'dart:collection';

import 'models/note.dart';
import 'services/note_service.dart';

// Enum for save states
enum SaveState {
  saved,
  saving,
  error,
  idle,
}

class SaveTask {
  final String folderPath;
  final String title;
  final String content;
  final bool isPinned;
  final Note? existingNote;
  final DateTime timestamp;
  final Completer<Note> completer;
  final String sessionId;

  SaveTask({
    required this.folderPath,
    required this.title,
    required this.content,
    required this.isPinned,
    this.existingNote,
    String? sessionId,
  })  : timestamp = DateTime.now(),
        completer = Completer<Note>(),
        sessionId = sessionId ?? DateTime.now().millisecondsSinceEpoch.toString();

  Future<Note> get future => completer.future;
}

class SaveQueue {
  final NoteService _noteService;
  final Queue<SaveTask> _queue = Queue();
  bool _isProcessing = false;
  
  // Callbacks for UI updates
  void Function()? onSaveStart;
  void Function(Note note)? onSaveComplete;
  void Function(String error)? onSaveError;

  SaveQueue(this._noteService);

  /// Enqueue a save task and return a future that completes when saved
  Future<Note> enqueue(SaveTask task) {
    // If there's already a pending task with the same note, replace it
    _queue.removeWhere((existingTask) {
      final sameNote = existingTask.sessionId == task.sessionId;
      if (sameNote) {
        // Cancel the old task
        existingTask.completer.completeError('Superseded by newer save');
      }
      return sameNote;
    });

    _queue.add(task);
    _processQueue();
    return task.future;
  }

  Future<void> _processQueue() async {
    if (_isProcessing || _queue.isEmpty) return;

    _isProcessing = true;
    onSaveStart?.call();

    while (_queue.isNotEmpty) {
      final task = _queue.removeFirst();

      try {
        final savedNote = await _noteService.saveNote(
          folderPath: task.folderPath,
          title: task.title,
          content: task.content,
          isPinned: task.isPinned,
          note: task.existingNote,
        );

        task.completer.complete(savedNote);
        onSaveComplete?.call(savedNote);
      } catch (e) {
        // On error, re-queue the task at the front (retry logic)
        _queue.addFirst(task);
        onSaveError?.call(e.toString());
        
        // Break to prevent infinite retry loop
        // You could add retry count logic here
        task.completer.completeError(e);
        break;
      }
    }

    _isProcessing = false;

    // If more tasks were added while processing, continue
    if (_queue.isNotEmpty) {
      _processQueue();
    }
  }

  /// Wait for all pending saves to complete
  Future<void> flush() async {
    final pendingTasks = List.of(_queue);
    if (pendingTasks.isEmpty && !_isProcessing) return;

    // Wait for all pending tasks
    await Future.wait(
      pendingTasks.map((task) => task.future.catchError((_) {})),
    );
  }

  /// Check if there are pending saves
  bool get hasPendingSaves => _queue.isNotEmpty || _isProcessing;

  /// Clear all pending saves (use with caution)
  void clear() {
    for (final task in _queue) {
      task.completer.completeError('Queue cleared');
    }
    _queue.clear();
  }

  void dispose() {
    clear();
  }
}