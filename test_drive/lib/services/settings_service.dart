import 'package:shared_preferences/shared_preferences.dart';

/// Service for managing app settings.
class SettingsService {
  static const String _folderKey = 'note_folder';

  static SettingsService? _instance;
  final SharedPreferences _prefs;

  SettingsService._(this._prefs);

  static Future<SettingsService> getInstance() async {
    if (_instance == null) {
      final prefs = await SharedPreferences.getInstance();
      _instance = SettingsService._(prefs);
    }
    return _instance!;
  }

  String? getFolder() {
    return _prefs.getString(_folderKey);
  }

  Future<void> setFolder(String folderPath) async {
    await _prefs.setString(_folderKey, folderPath);
  }

  Future<void> clearFolder() async {
    await _prefs.remove(_folderKey);
  }

  bool hasFolder() {
    return _prefs.getString(_folderKey) != null;
  }
}
