import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../models/note.dart';
import '../services/note_service.dart';
import '../services/settings_service.dart';
import '../widgets/app_drawer.dart';
import '../widgets/note_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  SettingsService? _settingsService;
  final NoteService _noteService = NoteService();

  List<Note> _notes = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initServices();
  }

  Future<void> _initServices() async {
    try {
      final settingsService = await SettingsService.create();
      setState(() {
        _settingsService = settingsService;
      });
      await _loadNotes();
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to initialize: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadNotes() async {
    if (_settingsService == null) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final folders = _settingsService!.getFolders();
      if (folders.isEmpty) {
        setState(() {
          _notes = [];
          _isLoading = false;
        });
        return;
      }

      final notes = await _noteService.loadNotesFromFolders(folders);
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

  void _onSettingsChanged() {
    _loadNotes();
  }

  Future<void> _createNewNote() async {
    if (_settingsService == null) return;

    final defaultFolder = _settingsService!.getDefaultSaveFolder();
    if (defaultFolder == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please configure a folder in Settings first'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Show dialog to create note
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => _CreateNoteDialog(),
    );

    if (result != null && mounted) {
      try {
        final note = await _noteService.createNote(
          folderPath: defaultFolder,
          title: result['title'] ?? 'Untitled',
          content: result['content'] ?? '',
        );
        setState(() {
          _notes.insert(0, note);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Created note: ${note.title}'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to create note: $e'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
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

  @override
  Widget build(BuildContext context) {
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
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () {},
          ),
        ],
      ),
      drawer: AppDrawer(
        onSettingsChanged: _onSettingsChanged,
      ),
      body: _buildBody(),
      floatingActionButton: kIsWeb
          ? null
          : FloatingActionButton(
              onPressed: _createNewNote,
              tooltip: 'Add Note',
              child: const Icon(Icons.add),
            ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadNotes,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_notes.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: _loadNotes,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Pinned Section
          if (_pinnedNotes.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 12),
              child: Row(
                children: [
                  Icon(
                    Icons.push_pin,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Pinned',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ],
              ),
            ),
            _buildNotesGrid(_pinnedNotes),
            const SizedBox(height: 24),
          ],
          // Others Section
          if (_otherNotes.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 12),
              child: Text(
                'Others',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
            _buildNotesGrid(_otherNotes),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    // Show web-specific message
    if (kIsWeb) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.web,
                size: 64,
                color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'Web Version',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'File system access is not available on web.\nPlease use the desktop or mobile app to manage notes.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                    ),
              ),
            ],
          ),
        ),
      );
    }

    final hasFolders = _settingsService?.getFolders().isNotEmpty ?? false;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              hasFolders ? Icons.note_outlined : Icons.folder_open,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              hasFolders ? 'No notes found' : 'No folders configured',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              hasFolders
                  ? 'Create a new note or add markdown files to your folders'
                  : 'Open Settings from the menu to add folders',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                  ),
            ),
            if (!hasFolders) ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () {
                  _scaffoldKey.currentState?.openDrawer();
                },
                icon: const Icon(Icons.menu),
                label: const Text('Open Menu'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNotesGrid(List<Note> notes) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Responsive column count based on width
        int crossAxisCount = 2;
        if (constraints.maxWidth > 900) {
          crossAxisCount = 4;
        } else if (constraints.maxWidth > 600) {
          crossAxisCount = 3;
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1.4,
          ),
          itemCount: notes.length,
          itemBuilder: (context, index) => NoteCard(note: notes[index]),
        );
      },
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _CreateNoteDialog extends StatefulWidget {
  @override
  State<_CreateNoteDialog> createState() => _CreateNoteDialogState();
}

class _CreateNoteDialogState extends State<_CreateNoteDialog> {
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Note'),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
              ),
              autofocus: true,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _contentController,
              decoration: const InputDecoration(
                labelText: 'Content',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              maxLines: 5,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            if (_titleController.text.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Please enter a title'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
              return;
            }
            Navigator.pop(context, {
              'title': _titleController.text,
              'content': _contentController.text,
            });
          },
          child: const Text('Create'),
        ),
      ],
    );
  }
}
