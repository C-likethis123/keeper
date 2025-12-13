import 'dart:async';

import 'package:flutter/material.dart';

import '../models/note.dart';
import '../services/note_service.dart';
import '../widgets/note_title_field.dart';
import '../widgets/save_indicator.dart';
import '../widgets/hybrid_editor/hybrid_editor.dart';

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
  final NoteService _noteService = NoteService();
  final ValueNotifier<int> _saveTrigger = ValueNotifier(0);

  Timer? _autoSaveTimer;
  Note? _currentNote;
  bool _isPinned = false;
  bool _hasUnsavedChanges = false;

  late String _title;
  late String _content;

  static const _autoSaveDelay = Duration(seconds: 3);

  @override
  void initState() {
    super.initState();
    _currentNote = widget.existingNote;
    _title = widget.existingNote?.title ?? '';
    _content = widget.existingNote?.content ?? '';
    _isPinned = widget.existingNote?.isPinned ?? false;
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _saveTrigger.dispose();
    super.dispose();
  }

  void _onTitleChanged(String value) {
    _title = value;
    _hasUnsavedChanges = true;
    _scheduleAutoSave();
  }

  void _onContentChanged(String value) {
    _content = value;
    _hasUnsavedChanges = true;
    _scheduleAutoSave();
  }

  void _scheduleAutoSave() {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer(_autoSaveDelay, _save);
  }

  Future<void> _save() async {
    final title = _title.trim();
    final content = _content;

    // Don't save if title is empty
    if (title.isEmpty) return;

    try {
      if (_currentNote == null) {
        // Create new note
        final note = await _noteService.createNote(
          folderPath: widget.folderPath,
          title: title,
          content: content,
          isPinned: _isPinned,
        );
        _currentNote = note;
      } else {
        // Update existing note
        final updated = await _noteService.updateNote(
          _currentNote!,
          newTitle: title,
          newContent: content,
          isPinned: _isPinned,
        );
        _currentNote = updated;
      }

      _hasUnsavedChanges = false;
      _saveTrigger.value++;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _togglePin() {
    setState(() => _isPinned = !_isPinned);
    _hasUnsavedChanges = true;
    _scheduleAutoSave();
  }

  Future<bool> _onWillPop() async {
    // Save any pending changes before leaving
    _autoSaveTimer?.cancel();
    if (_hasUnsavedChanges && _title.trim().isNotEmpty) {
      await _save();
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isNewNote = widget.existingNote == null && _currentNote == null;

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _onWillPop()) {
          if (context.mounted) Navigator.pop(context);
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
          title: SaveIndicator(trigger: _saveTrigger),
          actions: [
            IconButton(
              onPressed: _togglePin,
              icon: Icon(
                _isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                color: _isPinned ? colorScheme.primary : colorScheme.onSurfaceVariant,
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
