import 'package:flutter/material.dart';

import '../models/note.dart';
import '../services/note_service.dart';
import '../services/settings_service.dart';
import '../widgets/app_drawer.dart';
import '../widgets/app_text_field.dart';
import '../widgets/empty_state.dart';
import 'screen_states/error_screen.dart';
import 'screen_states/loader.dart';
import '../widgets/notes_section.dart';
import 'note_editor_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final Future<SettingsService> _initFuture = SettingsService.getInstance();

  @override
  Widget build(BuildContext context) {
    final appBar = AppBar(
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      title: const Text('Notes'),
    );
    return FutureBuilder<SettingsService>(
      future: _initFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(appBar: appBar, body: const Loader());
        }

        if (snapshot.hasError) {
          return Scaffold(
            appBar: appBar,
            body: ErrorScreen(
              errorMessage: 'Failed to initialize: ${snapshot.error}',
            ),
          );
        }

        return _HomeScreenContent(settingsService: snapshot.data!);
      },
    );
  }
}

/// Main home screen content
class _HomeScreenContent extends StatefulWidget {
  final SettingsService settingsService;

  const _HomeScreenContent({required this.settingsService});

  @override
  State<_HomeScreenContent> createState() => _HomeScreenContentState();
}

class _HomeScreenContentState extends State<_HomeScreenContent> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final NoteService _noteService = NoteService();

  List<Note> _notes = [];
  bool _isLoading = true;
  String? _errorMessage;

  SettingsService get _settings => widget.settingsService;

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  Future<void> _loadNotes() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final folder = _settings.getFolder();
      final List<Note> notes;
      if (folder != null) {
        notes = await _noteService.loadNotesFromFolders([folder]);
      } else {
        notes = [];
      }

      setState(() {
        _notes = notes;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load notes: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _createNewNote() async {
    final folder = _settings.getFolder();
    if (folder == null) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => NoteEditorScreen(folderPath: folder),
      ),
    );
    // Reload notes when returning from editor
    await _loadNotes();
  }

  Future<void> _editNote(Note note) async {
    final folder = _settings.getFolder();
    if (folder == null) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => NoteEditorScreen(
          folderPath: folder,
          existingNote: note,
        ),
      ),
    );
    // Reload notes when returning from editor
    await _loadNotes();
  }

  List<Note> get _pinnedNotes {
    final pinned = _notes.where((n) => n.isPinned).toList();
    pinned.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));
    return pinned;
  }

  List<Note> get _otherNotes {
    final others = _notes.where((n) => !n.isPinned).toList();
    others.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));
    return others;
  }

  Future<void> _togglePin(Note note) async {
    try {
      final updated = await _noteService.saveNote(
        folderPath: note.sourceFolder!,
        title: note.title,
        content: note.content,
        isPinned: !note.isPinned,
        note: note
      );
      setState(() {
        final index = _notes.indexWhere((n) => n.id == note.id);
        if (index != -1) {
          _notes[index] = updated;
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update note: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _deleteNote(Note note) async {
    try {
      final updated = await _noteService.deleteNote(note);
      if (updated) {
        await _loadNotes();
      };
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Deleted "${note.title}"'),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'Undo',
              onPressed: () => _noteService.saveNote(
                  folderPath: note.sourceFolder!,
                  title: note.title,
                  content: note.content,
                  isPinned: note.isPinned,
                  note: note,
                ).then((_) => _loadNotes()),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete note: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _navigateToSettings() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const SettingsScreen()),
    );
    // Reload notes when returning from settings (folder may have changed)
    await _loadNotes();
  }

  @override
  Widget build(BuildContext context) {
    final hasFolder = _settings.hasFolder();
    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () {
            _scaffoldKey.currentState?.openDrawer();
          },
        ),
        title: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: const AppTextField.search(),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () {},
          ),
        ],
      ),
      drawer: AppDrawer(onSettingsTap: _navigateToSettings),
      body: _buildBody(),
      floatingActionButton: hasFolder
          ? FloatingActionButton(
              onPressed: _createNewNote,
              tooltip: 'Add Note',
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Loader();
    }

    if (_errorMessage != null) {
      return ErrorScreen(
        errorMessage: _errorMessage ?? 'Unknown error',
        onRetry: _loadNotes,
      );
    }

    if (_notes.isEmpty) {
      return _buildEmptyState();
    }

    final sections = [
      (title: 'Pinned', icon: Icons.push_pin, notes: _pinnedNotes),
      (title: 'Others', icon: null, notes: _otherNotes),
    ];

    return RefreshIndicator(
      onRefresh: _loadNotes,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        separatorBuilder: (context, index) => const SizedBox(height: 24),
        itemBuilder: (context, index) {
          final section = sections[index];
          return NotesSection(
            title: section.title,
            icon: section.icon,
            notes: section.notes,
            onNoteTap: _editNote,
            onPinToggle: _togglePin,
            onDelete: _deleteNote,
          );
        },
        itemCount: sections.length,
      ),
    );
  }

  Widget _buildEmptyState() {
    final hasFolder = _settings.hasFolder();

    return EmptyState(
      icon: hasFolder ? Icons.note_outlined : Icons.folder_open,
      title: hasFolder ? 'No notes found' : 'No folder configured',
      subtitle: hasFolder
          ? 'Create a new note or add markdown files to your folder'
          : 'Add a folder to start loading your notes',
      action: hasFolder
          ? null
          : FilledButton.icon(
              onPressed: _navigateToSettings,
              icon: const Icon(Icons.settings),
              label: const Text('Open Settings'),
            ),
    );
  }
}
