import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service for managing app settings.
class SettingsService {
  static const String _folderKey = 'note_folder';

  static final SettingsService _instance = SettingsService._internal();

  late SharedPreferences _prefs;
  final Map<String, Object?> _cache = {};

  SettingsService._internal();

  static SettingsService get instance => _instance;

  /// Must be called once at app startup
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();

    // Load all relevant settings into memory
    _cache[_folderKey] = _prefs.getString(_folderKey);
  }

  /// ---- Sync API from here onward ----

  String? get folder => _cache[_folderKey] as String?;

  bool get hasFolder => _cache[_folderKey] != null;

  Future<void> setFolder(String folderPath) async {
    _cache[_folderKey] = folderPath;
    await _prefs.setString(_folderKey, folderPath);
  }

  Future<void> clearFolder() async {
    _cache.remove(_folderKey);
    await _prefs.remove(_folderKey);
  }

  /// Optional but useful for debugging
  @visibleForTesting
  Map<String, Object?> dumpCache() => Map.unmodifiable(_cache);
}
