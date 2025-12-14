import 'dart:async';

import 'package:flutter/material.dart';

import '../models/note.dart';
import '../services/note_service.dart';
import '../widgets/note_title_field.dart';
import '../widgets/save_indicator.dart';
import '../widgets/hybrid_editor/hybrid_editor.dart';
import '../save_queue.dart';

class NoteEditorScreen extends StatefulWidget {
  final String folderPath;
  final Note? existingNote;

  const NoteEditorScreen({
    super.key,
    required this.folderPath,
    this.existingNote,
  });

  @override
  State<NoteEditorScreen> createState() => _NoteEditorScreenState();
}

class _NoteEditorScreenState extends State<NoteEditorScreen> {
  late final String _editingSessionId;
  final NoteService _noteService = NoteService();
  Timer? _autoSaveTimer;
  static const _autoSaveDelay = Duration(seconds: 3);
  late final SaveQueue _saveQueue;
  final ValueNotifier<SaveState> _saveState = ValueNotifier(SaveState.idle);

  Note? _currentNote;
  bool _isPinned = false;

  late String _title;
  late String _content;

  @override
  void initState() {
    super.initState();
    _currentNote = widget.existingNote;
    _title = widget.existingNote?.title ?? '';
    _content = widget.existingNote?.content ?? '';
    _isPinned = widget.existingNote?.isPinned ?? false;
    _editingSessionId =
        widget.existingNote?.id ??
        DateTime.now().millisecondsSinceEpoch.toString();
    // Initialize save queue with callbacks
    _saveQueue = SaveQueue(_noteService)
      ..onSaveStart = () {
        _saveState.value = SaveState.saving;
      }
      ..onSaveComplete = (note) {
        _currentNote = note;
        _saveState.value = SaveState.saved;
      }
      ..onSaveError = (error) {
        _saveState.value = SaveState.error;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to save: $error'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      };
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _saveQueue.dispose();
    _saveState.dispose();
    super.dispose();
  }

  void _onTitleChanged(String value) {
    _title = value;
    _scheduleAutoSave();
  }

  void _onContentChanged(String value) {
    _content = value;
    _scheduleAutoSave();
  }

  void _scheduleAutoSave() {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer(_autoSaveDelay, _save);
  }

  Future<void> _save() async {
    final title = _title.trim();
    final content = _content;

    if (title.isEmpty && content.isEmpty) {
      return;
    }

    // Create and enqueue the save task
    final task = SaveTask(
      folderPath: widget.folderPath,
      title: title.isEmpty ? 'Untitled' : title,
      content: content,
      isPinned: _isPinned,
      existingNote: _currentNote,
      sessionId: _editingSessionId,
    );

    _saveQueue.enqueue(task);
  }

  void _togglePin() {
    setState(() => _isPinned = !_isPinned);
    _scheduleAutoSave();
  }

  Future<bool> _onWillPop() async {
    // Save any pending changes before leaving
    _autoSaveTimer?.cancel();
    if (_title.trim().isNotEmpty || _content.trim().isNotEmpty) {
      await _save();
    }
    await _saveQueue.flush();
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isNewNote = widget.existingNote == null && _currentNote == null;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop) {
          if (await _onWillPop()) {
            if (context.mounted) Navigator.pop(context);
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: colorScheme.surface,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () async {
              if (await _onWillPop()) {
                if (context.mounted) Navigator.pop(context);
              }
            },
          ),
          title: SaveIndicator(saveState: _saveState),
          actions: [
            IconButton(
              onPressed: _togglePin,
              icon: Icon(
                _isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                color: _isPinned
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant,
              ),
              tooltip: _isPinned ? 'Unpin note' : 'Pin note',
            ),
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              NoteTitleField(
                initialValue: _title,
                autofocus: isNewNote,
                onChanged: _onTitleChanged,
              ),
              const Divider(),
              Expanded(
                child: HybridEditor(
                  initialContent: _content,
                  onChanged: _onContentChanged,
                  autofocus: !isNewNote,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
