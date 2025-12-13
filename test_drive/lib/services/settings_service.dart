import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const String _foldersKey = 'note_folders';
  static const String _defaultFolderKey = 'default_save_folder';

  final SharedPreferences _prefs;

  SettingsService(this._prefs);

  static Future<SettingsService> create() async {
    final prefs = await SharedPreferences.getInstance();
    return SettingsService(prefs);
  }

  /// Get all configured folders
  List<String> getFolders() {
    return _prefs.getStringList(_foldersKey) ?? [];
  }

  /// Add a new folder to the list
  Future<bool> addFolder(String folderPath) async {
    final folders = getFolders();
    if (folders.contains(folderPath)) {
      return false; // Already exists
    }
    folders.add(folderPath);
    await _prefs.setStringList(_foldersKey, folders);

    // If this is the first folder, set it as default
    if (folders.length == 1) {
      await setDefaultSaveFolder(folderPath);
    }
    return true;
  }

  /// Remove a folder from the list
  Future<bool> removeFolder(String folderPath) async {
    final folders = getFolders();
    final removed = folders.remove(folderPath);
    if (removed) {
      await _prefs.setStringList(_foldersKey, folders);

      // If we removed the default folder, update it
      final defaultFolder = getDefaultSaveFolder();
      if (defaultFolder == folderPath) {
        if (folders.isNotEmpty) {
          await setDefaultSaveFolder(folders.first);
        } else {
          await _prefs.remove(_defaultFolderKey);
        }
      }
    }
    return removed;
  }

  /// Get the default folder for saving new notes
  String? getDefaultSaveFolder() {
    return _prefs.getString(_defaultFolderKey);
  }

  /// Set the default folder for saving new notes
  Future<void> setDefaultSaveFolder(String folderPath) async {
    await _prefs.setString(_defaultFolderKey, folderPath);
  }

  /// Check if a folder is configured
  bool hasFolder(String folderPath) {
    return getFolders().contains(folderPath);
  }

  /// Clear all folders
  Future<void> clearFolders() async {
    await _prefs.remove(_foldersKey);
    await _prefs.remove(_defaultFolderKey);
  }
}


