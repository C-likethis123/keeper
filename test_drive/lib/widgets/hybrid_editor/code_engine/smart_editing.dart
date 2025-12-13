import 'package:flutter/services.dart';
import 'language_registry.dart';

/// Result of a smart edit operation
class SmartEditResult {
  final String newText;
  final int newCursorOffset;
  final bool handled;

  const SmartEditResult({
    required this.newText,
    required this.newCursorOffset,
    this.handled = true,
  });

  const SmartEditResult.notHandled()
      : newText = '',
        newCursorOffset = 0,
        handled = false;
}

/// Handles smart editing features for code blocks
class SmartEditingHandler {
  final LanguageConfig? languageConfig;

  /// Default brace pairs if no language config is provided
  static const Map<String, String> defaultBracePairs = {
    '{': '}',
    '(': ')',
    '[': ']',
    '"': '"',
    "'": "'",
    '`': '`',
  };

  /// Characters that trigger auto-indent on newline
  static const Set<String> indentTriggers = {'{', '(', '[', ':'};

  /// Characters that trigger outdent
  static const Set<String> outdentTriggers = {'}', ')', ']'};

  SmartEditingHandler({this.languageConfig});

  /// Gets the brace pairs for the current language
  Map<String, String> get bracePairs =>
      languageConfig?.bracePairs ?? defaultBracePairs;

  /// Gets the indent string for the current language
  String get indentString {
    if (languageConfig?.useTabs == true) {
      return '\t';
    }
    return ' ' * (languageConfig?.indentSize ?? 2);
  }

  /// Handles a character insertion for brace completion
  SmartEditResult handleCharacterInsert(
    String char,
    String text,
    int cursorOffset,
  ) {
    // Check if this is an opening brace
    if (bracePairs.containsKey(char)) {
      final closingChar = bracePairs[char]!;

      // For quotes, check if we're inside a string already
      if (char == '"' || char == "'" || char == '`') {
        // If the next char is the same quote, just move past it
        if (cursorOffset < text.length && text[cursorOffset] == char) {
          return SmartEditResult(
            newText: text,
            newCursorOffset: cursorOffset + 1,
          );
        }

        // Check if we should auto-complete
        if (_shouldAutoCompleteQuote(text, cursorOffset, char)) {
          final newText = text.substring(0, cursorOffset) +
              char +
              closingChar +
              text.substring(cursorOffset);
          return SmartEditResult(
            newText: newText,
            newCursorOffset: cursorOffset + 1,
          );
        }
      } else {
        // Auto-complete brackets
        final newText = text.substring(0, cursorOffset) +
            char +
            closingChar +
            text.substring(cursorOffset);
        return SmartEditResult(
          newText: newText,
          newCursorOffset: cursorOffset + 1,
        );
      }
    }

    // Check if this is a closing brace and we can skip over it
    if (bracePairs.containsValue(char)) {
      if (cursorOffset < text.length && text[cursorOffset] == char) {
        return SmartEditResult(
          newText: text,
          newCursorOffset: cursorOffset + 1,
        );
      }
    }

    return const SmartEditResult.notHandled();
  }

  /// Handles backspace for brace deletion
  SmartEditResult handleBackspace(String text, int cursorOffset) {
    if (cursorOffset == 0 || cursorOffset > text.length) {
      return const SmartEditResult.notHandled();
    }

    final charBefore = text[cursorOffset - 1];

    // Check if we're deleting an opening brace with its closing pair
    if (bracePairs.containsKey(charBefore)) {
      final closingChar = bracePairs[charBefore]!;
      if (cursorOffset < text.length && text[cursorOffset] == closingChar) {
        // Delete both the opening and closing brace
        final newText = text.substring(0, cursorOffset - 1) +
            text.substring(cursorOffset + 1);
        return SmartEditResult(
          newText: newText,
          newCursorOffset: cursorOffset - 1,
        );
      }
    }

    return const SmartEditResult.notHandled();
  }

  /// Handles enter key for auto-indentation
  SmartEditResult handleEnter(String text, int cursorOffset) {
    // Get the current line
    final beforeCursor = text.substring(0, cursorOffset);
    final afterCursor = text.substring(cursorOffset);
    final lastNewline = beforeCursor.lastIndexOf('\n');
    final currentLine =
        lastNewline == -1 ? beforeCursor : beforeCursor.substring(lastNewline + 1);

    // Calculate the current indentation
    final currentIndent = _getLeadingWhitespace(currentLine);
    var newIndent = currentIndent;

    // Check if we need to increase indent
    final trimmedLine = currentLine.trimRight();
    if (trimmedLine.isNotEmpty && indentTriggers.contains(trimmedLine[trimmedLine.length - 1])) {
      newIndent += indentString;
    }

    // Check if we're between braces
    if (afterCursor.isNotEmpty && outdentTriggers.contains(afterCursor[0])) {
      // We're between opening and closing brace
      // Add newline with increased indent, then newline with original indent, then closing brace
      final newText = '$beforeCursor\n$newIndent\n$currentIndent$afterCursor';
      return SmartEditResult(
        newText: newText,
        newCursorOffset: cursorOffset + 1 + newIndent.length,
      );
    }

    // Normal newline with indentation
    final newText = '$beforeCursor\n$newIndent$afterCursor';
    return SmartEditResult(
      newText: newText,
      newCursorOffset: cursorOffset + 1 + newIndent.length,
    );
  }

  /// Handles tab key for indentation
  SmartEditResult handleTab(
    String text,
    int cursorOffset, {
    bool shift = false,
  }) {
    if (shift) {
      // Outdent
      return _handleOutdent(text, cursorOffset);
    } else {
      // Indent
      return _handleIndent(text, cursorOffset);
    }
  }

  SmartEditResult _handleIndent(String text, int cursorOffset) {
    // Get the current line start
    final beforeCursor = text.substring(0, cursorOffset);
    final lastNewline = beforeCursor.lastIndexOf('\n');
    final lineStart = lastNewline + 1;

    // Insert indent at line start
    final newText =
        text.substring(0, lineStart) + indentString + text.substring(lineStart);
    return SmartEditResult(
      newText: newText,
      newCursorOffset: cursorOffset + indentString.length,
    );
  }

  SmartEditResult _handleOutdent(String text, int cursorOffset) {
    // Get the current line
    final beforeCursor = text.substring(0, cursorOffset);
    final lastNewline = beforeCursor.lastIndexOf('\n');
    final lineStart = lastNewline + 1;
    final nextNewline = text.indexOf('\n', lineStart);
    final lineEnd = nextNewline == -1 ? text.length : nextNewline;
    final currentLine = text.substring(lineStart, lineEnd);

    // Check if line starts with indent
    if (currentLine.startsWith(indentString)) {
      final newText = text.substring(0, lineStart) +
          currentLine.substring(indentString.length) +
          text.substring(lineEnd);
      return SmartEditResult(
        newText: newText,
        newCursorOffset: (cursorOffset - indentString.length).clamp(lineStart, text.length),
      );
    } else if (currentLine.startsWith('\t')) {
      final newText = text.substring(0, lineStart) +
          currentLine.substring(1) +
          text.substring(lineEnd);
      return SmartEditResult(
        newText: newText,
        newCursorOffset: (cursorOffset - 1).clamp(lineStart, text.length),
      );
    }

    return const SmartEditResult.notHandled();
  }

  /// Finds the matching bracket for the bracket at the given position
  int? findMatchingBracket(String text, int position) {
    if (position < 0 || position >= text.length) return null;

    final char = text[position];
    String? matchChar;
    bool searchForward = true;

    // Check if it's an opening bracket
    if (bracePairs.containsKey(char)) {
      matchChar = bracePairs[char];
      searchForward = true;
    }
    // Check if it's a closing bracket
    else {
      for (final entry in bracePairs.entries) {
        if (entry.value == char) {
          matchChar = entry.key;
          searchForward = false;
          break;
        }
      }
    }

    if (matchChar == null) return null;

    int depth = 1;
    if (searchForward) {
      for (int i = position + 1; i < text.length; i++) {
        if (text[i] == char) {
          depth++;
        } else if (text[i] == matchChar) {
          depth--;
          if (depth == 0) return i;
        }
      }
    } else {
      for (int i = position - 1; i >= 0; i--) {
        if (text[i] == char) {
          depth++;
        } else if (text[i] == matchChar) {
          depth--;
          if (depth == 0) return i;
        }
      }
    }

    return null;
  }

  bool _shouldAutoCompleteQuote(String text, int cursorOffset, String quote) {
    // Don't auto-complete if at the end of an identifier
    if (cursorOffset > 0) {
      final charBefore = text[cursorOffset - 1];
      if (RegExp(r'[a-zA-Z0-9_]').hasMatch(charBefore)) {
        return false;
      }
    }

    // Count quotes before cursor
    int quoteCount = 0;
    for (int i = 0; i < cursorOffset; i++) {
      if (text[i] == quote && (i == 0 || text[i - 1] != '\\')) {
        quoteCount++;
      }
    }

    // If odd number of quotes, we're inside a string
    return quoteCount % 2 == 0;
  }

  String _getLeadingWhitespace(String line) {
    final match = RegExp(r'^[\t ]*').firstMatch(line);
    return match?.group(0) ?? '';
  }
}

/// Keyboard shortcut handler for code editor
class CodeKeyboardHandler {
  final SmartEditingHandler smartEditor;
  final void Function(String text, int cursorOffset) onTextChanged;

  CodeKeyboardHandler({
    required this.smartEditor,
    required this.onTextChanged,
  });

  /// Handles a key event
  bool handleKeyEvent(
    KeyEvent event,
    String text,
    int cursorOffset,
  ) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return false;
    }

    // Handle Enter
    if (event.logicalKey == LogicalKeyboardKey.enter) {
      final result = smartEditor.handleEnter(text, cursorOffset);
      if (result.handled) {
        onTextChanged(result.newText, result.newCursorOffset);
        return true;
      }
    }

    // Handle Tab
    if (event.logicalKey == LogicalKeyboardKey.tab) {
      final shift = HardwareKeyboard.instance.isShiftPressed;
      final result = smartEditor.handleTab(text, cursorOffset, shift: shift);
      if (result.handled) {
        onTextChanged(result.newText, result.newCursorOffset);
        return true;
      }
    }

    // Handle Backspace
    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      final result = smartEditor.handleBackspace(text, cursorOffset);
      if (result.handled) {
        onTextChanged(result.newText, result.newCursorOffset);
        return true;
      }
    }

    return false;
  }

  /// Handles character input
  bool handleCharacterInput(
    String char,
    String text,
    int cursorOffset,
  ) {
    final result = smartEditor.handleCharacterInsert(char, text, cursorOffset);
    if (result.handled) {
      onTextChanged(result.newText, result.newCursorOffset);
      return true;
    }
    return false;
  }
}

