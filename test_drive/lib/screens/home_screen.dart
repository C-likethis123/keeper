import 'package:flutter/material.dart';

import '../models/note.dart';
import '../models/note_metadata.dart';
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

/// Main home screen content with infinite scroll
class _HomeScreenContent extends StatefulWidget {
  final SettingsService settingsService;

  const _HomeScreenContent({required this.settingsService});

  @override
  State<_HomeScreenContent> createState() => _HomeScreenContentState();
}

class _HomeScreenContentState extends State<_HomeScreenContent> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final NoteService _noteService = NoteService();
  final ScrollController _scrollController = ScrollController();

  List<NoteMetadata> _allMetadata = [];
  List<Note> _loadedNotes = [];
  bool _isLoadingMetadata = true;
  bool _isLoadingMore = false;
  String? _errorMessage;

  static const int _pageSize = 20;
  int _currentPage = 0;

  SettingsService get _settings => widget.settingsService;

  @override
  void initState() {
    super.initState();
    _loadNotesMetadata();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Scroll listener for infinite loading
  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      // Load more when 200px from bottom
      _loadNextPage();
    }
  }

  /// Step 1: Scan all files to get metadata (fast)
  Future<void> _loadNotesMetadata() async {
    setState(() {
      _isLoadingMetadata = true;
      _errorMessage = null;
      _currentPage = 0;
      _loadedNotes = [];
    });

    try {
      final folder = _settings.getFolder();
      final List<NoteMetadata> metadata;
      if (folder != null) {
        metadata = await _noteService.scanNotesMetadata([folder]);
        // Sort by last modified (newest first)
        metadata.sort((a, b) => b.lastModified.compareTo(a.lastModified));
      } else {
        metadata = [];
      }

      setState(() {
        _allMetadata = metadata;
        _isLoadingMetadata = false;
      });

      // Load first page
      await _loadNextPage();
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to scan notes: $e';
        _isLoadingMetadata = false;
      });
    }
  }

  /// Step 2: Load next batch of notes
  Future<void> _loadNextPage() async {
    // Prevent multiple simultaneous loads
    if (_isLoadingMore || _isLoadingMetadata) return;

    // Check if we've loaded everything
    if (_loadedNotes.length >= _allMetadata.length) return;

    setState(() {
      _isLoadingMore = true;
    });

    try {
      final notes = await _noteService.loadNotesForPage(
        _allMetadata,
        _currentPage,
        _pageSize,
      );

      setState(() {
        _loadedNotes.addAll(notes);
        _currentPage++;
        _isLoadingMore = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load notes: $e';
        _isLoadingMore = false;
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
    // Reload metadata when returning from editor
    await _loadNotesMetadata();
  }

  Future<void> _editNote(Note note) async {
    final folder = _settings.getFolder();
    if (folder == null) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            NoteEditorScreen(folderPath: folder, existingNote: note),
      ),
    );
    // If refresh fails, just reload everything
    await _loadNotesMetadata();
  }

  List<Note> get _pinnedNotes {
    final pinned = _loadedNotes.where((n) => n.isPinned).toList();
    pinned.sort((a, b) => b.lastUpdated.compareTo(a.lastUpdated));
    return pinned;
  }

  List<Note> get _otherNotes {
    final others = _loadedNotes.where((n) => !n.isPinned).toList();
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
        note: note,
      );

      // Update the note in the list
      setState(() {
        final index = _loadedNotes.indexWhere((n) => n.id == note.id);
        if (index != -1) {
          _loadedNotes[index] = updated;
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
      final success = await _noteService.deleteNote(note);
      if (success) {
        setState(() {
          _loadedNotes.removeWhere((n) => n.id == note.id);
          _allMetadata.removeWhere((m) => m.filePath == note.filePath);
        });
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Deleted "${note.title}"'),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'Undo',
              onPressed: () => _noteService
                  .saveNote(
                    folderPath: note.sourceFolder!,
                    title: note.title,
                    content: note.content,
                    isPinned: note.isPinned,
                    note: note,
                  )
                  .then((_) => _loadNotesMetadata()),
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
    // Reload metadata when returning from settings (folder may have changed)
    _noteService.clearCache();
    await _loadNotesMetadata();
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
    if (_isLoadingMetadata) {
      return const Loader();
    }

    if (_errorMessage != null) {
      return ErrorScreen(
        errorMessage: _errorMessage ?? 'Unknown error',
        onRetry: _loadNotesMetadata,
      );
    }

    if (_allMetadata.isEmpty) {
      return _buildEmptyState();
    }

    if (_loadedNotes.isEmpty && !_isLoadingMore) {
      return const Center(child: Text('No notes loaded'));
    }

    final sections = [
      if (_pinnedNotes.isNotEmpty)
        (title: 'Pinned', icon: Icons.push_pin, notes: _pinnedNotes),
      if (_otherNotes.isNotEmpty)
        (title: 'Others', icon: null, notes: _otherNotes),
    ];

    return RefreshIndicator(
      onRefresh: _loadNotesMetadata,
      child: ListView.separated(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        separatorBuilder: (context, index) => const SizedBox(height: 24),
        itemCount: sections.length + (_isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          // Show loading indicator at bottom
          if (index == sections.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator()),
            );
          }

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
