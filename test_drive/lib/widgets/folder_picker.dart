import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../utils/platform_utils.dart';

class FolderPicker extends StatelessWidget {
  final String? folderPath;
  final String dialogTitle;
  final String emptyStateTitle;
  final String emptyStateSubtitle;
  final String selectButtonLabel;
  final String changeButtonLabel;
  final String removeButtonLabel;
  final ValueChanged<String?>? onFolderChanged;

  const FolderPicker({
    super.key,
    this.folderPath,
    this.dialogTitle = 'Select Folder',
    this.emptyStateTitle = 'No folder configured',
    this.emptyStateSubtitle = 'Select a folder to get started',
    this.selectButtonLabel = 'Select Folder',
    this.changeButtonLabel = 'Change Folder',
    this.removeButtonLabel = 'Remove',
    this.onFolderChanged,
  });

  String _getFolderDisplayName(String path) {
    return PlatformUtils.getPathBasename(path);
  }

  Future<void> _selectFolder(BuildContext context) async {
    try {
      final result = await FilePicker.platform.getDirectoryPath(
        dialogTitle: dialogTitle,
      );

      if (result != null) {
        onFolderChanged?.call(result);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error selecting folder: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _clearFolder(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Folder'),
        content: Text(
          'Remove "${_getFolderDisplayName(folderPath!)}" from settings?\n\n'
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

    if (confirmed == true) {
      onFolderChanged?.call(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (folderPath == null) {
      return _buildEmptyState(context);
    }
    return _buildFolderCard(context);
  }

  Widget _buildEmptyState(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
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
              emptyStateTitle,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              emptyStateSubtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                  ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => _selectFolder(context),
              icon: const Icon(Icons.folder),
              label: Text(selectButtonLabel),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFolderCard(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: colorScheme.primary,
          width: 2,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.folder,
                  color: colorScheme.primary,
                  size: 32,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _getFolderDisplayName(folderPath!),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        folderPath!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () => _selectFolder(context),
                  child: Text(changeButtonLabel),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => _clearFolder(context),
                  style: TextButton.styleFrom(
                    foregroundColor: colorScheme.error,
                  ),
                  child: Text(removeButtonLabel),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

