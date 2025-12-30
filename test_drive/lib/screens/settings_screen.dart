import 'package:flutter/material.dart';

import '../services/settings_service.dart';
import '../utils/platform_utils.dart';
import '../widgets/folder_picker.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final SettingsService? _settingsService;
  String? _folder;

  @override
  void initState() {
    super.initState();
    _settingsService = SettingsService.instance;
    _folder = _settingsService?.folder;
  }

  Future<void> _onFolderChanged(String? newFolder) async {
    if (_settingsService == null) return;

    if (newFolder != null) {
      await _settingsService.setFolder(newFolder);
      setState(() => _folder = newFolder);

      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Set folder: ${PlatformUtils.getPathBasename(newFolder)}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      await _settingsService.clearFolder();
      setState(() => _folder = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: colorScheme.surface,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Folder Section
          Text(
            'Notes Folder',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Select a folder to read and save notes.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),

          // Folder Picker
          FolderPicker(
            folderPath: _folder,
            dialogTitle: 'Select Notes Folder',
            emptyStateTitle: 'No folder configured',
            emptyStateSubtitle: 'Select a folder to start loading notes',
            onFolderChanged: _onFolderChanged,
          ),

          const SizedBox(height: 32),

          // Mobile Platform Notice
          if (PlatformUtils.isMobile)
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
