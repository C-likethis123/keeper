import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../services/settings_service.dart';
import '../utils/platform_utils.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback? onSettingsChanged;

  const SettingsScreen({super.key, this.onSettingsChanged});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  SettingsService? _settingsService;
  List<String> _folders = [];
  String? _defaultFolder;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initSettings();
  }

  Future<void> _initSettings() async {
    final service = await SettingsService.create();
    setState(() {
      _settingsService = service;
      _folders = service.getFolders();
      _defaultFolder = service.getDefaultSaveFolder();
      _isLoading = false;
    });
  }

  Future<void> _addFolder() async {
    try {
      final result = await FilePicker.platform.getDirectoryPath(
        dialogTitle: 'Select Notes Folder',
      );

      if (result != null && _settingsService != null) {
        final added = await _settingsService!.addFolder(result);
        if (added) {
          setState(() {
            _folders = _settingsService!.getFolders();
            _defaultFolder = _settingsService!.getDefaultSaveFolder();
          });
          widget.onSettingsChanged?.call();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Added folder: ${_getFolderDisplayName(result)}'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Folder already exists'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error selecting folder: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _removeFolder(String folderPath) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Folder'),
        content: Text(
          'Remove "${_getFolderDisplayName(folderPath)}" from the list?\n\n'
          'This will not delete the folder or its files.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed == true && _settingsService != null) {
      await _settingsService!.removeFolder(folderPath);
      setState(() {
        _folders = _settingsService!.getFolders();
        _defaultFolder = _settingsService!.getDefaultSaveFolder();
      });
      widget.onSettingsChanged?.call();
    }
  }

  Future<void> _setDefaultFolder(String folderPath) async {
    if (_settingsService != null) {
      await _settingsService!.setDefaultSaveFolder(folderPath);
      setState(() {
        _defaultFolder = folderPath;
      });
      widget.onSettingsChanged?.call();
    }
  }

  String _getFolderDisplayName(String path) {
    return PlatformUtils.getPathBasename(path);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: colorScheme.surface,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Folders Section
                Text(
                  'Note Folders',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Add folders to read notes from. New notes will be saved to the default folder.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 16),

                // Web Platform Notice
                if (kIsWeb)
                  Card(
                    elevation: 0,
                    color: colorScheme.errorContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(
                            Icons.warning_amber_rounded,
                            color: colorScheme.onErrorContainer,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Folder access is not supported on web browsers. Please use the desktop or mobile app.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onErrorContainer,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else ...[
                  // Folder List (non-web only)
                  if (_folders.isEmpty)
                    Card(
                      elevation: 0,
                      color: colorScheme.surfaceContainerHighest,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Icon(
                              Icons.folder_open,
                              size: 48,
                              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'No folders configured',
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Add a folder to start loading notes',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                                  ),
                            ),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: _addFolder,
                              icon: const Icon(Icons.add),
                              label: const Text('Add Folder'),
                            ),
                          ],
                        ),
                      ),
                    )
                  else ...[
                    ...(_folders.map((folder) => _FolderCard(
                          folderPath: folder,
                          displayName: _getFolderDisplayName(folder),
                          isDefault: folder == _defaultFolder,
                          onSetDefault: () => _setDefaultFolder(folder),
                          onRemove: () => _removeFolder(folder),
                        ))),
                    const SizedBox(height: 16),
                    // Add Folder Button (only shown when folders exist)
                    OutlinedButton.icon(
                      onPressed: _addFolder,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Folder'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ],
                ],

                const SizedBox(height: 32),

                // Mobile Platform Notice
                if (!kIsWeb && PlatformUtils.isMobile)
                  Card(
                    elevation: 0,
                    color: colorScheme.tertiaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            color: colorScheme.onTertiaryContainer,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'On mobile devices, folder access may be limited to specific locations.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onTertiaryContainer,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _FolderCard extends StatelessWidget {
  final String folderPath;
  final String displayName;
  final bool isDefault;
  final VoidCallback onSetDefault;
  final VoidCallback onRemove;

  const _FolderCard({
    required this.folderPath,
    required this.displayName,
    required this.isDefault,
    required this.onSetDefault,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDefault ? colorScheme.primary : colorScheme.outlineVariant,
          width: isDefault ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.folder,
                  color: isDefault ? colorScheme.primary : colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isDefault)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                'Default',
                                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: colorScheme.onPrimaryContainer,
                                    ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        folderPath,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (!isDefault)
                  TextButton(
                    onPressed: onSetDefault,
                    child: const Text('Set as default'),
                  ),
                TextButton(
                  onPressed: onRemove,
                  style: TextButton.styleFrom(
                    foregroundColor: colorScheme.error,
                  ),
                  child: const Text('Remove'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

