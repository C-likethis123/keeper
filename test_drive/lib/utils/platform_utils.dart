import 'package:flutter/foundation.dart';

/// Platform utilities that work across all platforms including web
class PlatformUtils {
  PlatformUtils._();

  /// Get the path separator for the current platform
  static String get pathSeparator {
    if (kIsWeb) return '/';
    // Windows uses backslash, others use forward slash
    if (defaultTargetPlatform == TargetPlatform.windows) {
      return '\\';
    }
    return '/';
  }

  /// Check if we're on a mobile platform (iOS or Android)
  static bool get isMobile {
    return defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.android;
  }

  /// Check if we're on a desktop platform (Windows, macOS, Linux)
  static bool get isDesktop {
    return defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.linux;
  }

  /// Check if file system access is supported
  static bool get supportsFileSystem => !kIsWeb;

  /// Extract the last component of a path (folder/file name)
  static String getPathBasename(String path) {
    // Handle both Windows and Unix-style paths
    final parts = path.split(RegExp(r'[/\\]'));
    return parts.where((p) => p.isNotEmpty).lastOrNull ?? path;
  }
}
