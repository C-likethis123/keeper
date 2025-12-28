import 'package:flutter/services.dart';
import '../core/core.dart';

/// Result of handling a key event
enum KeyHandleResult { handled, ignored, passThrough }

/// A key binding that maps a key combination to an action
class KeyBinding {
  final LogicalKeyboardKey key;
  final bool ctrl;
  final bool shift;
  final bool alt;
  final bool meta;
  final String description;
  final KeyHandleResult Function(EditorState state) action;

  const KeyBinding({
    required this.key,
    this.ctrl = false,
    this.shift = false,
    this.alt = false,
    this.meta = false,
    required this.description,
    required this.action,
  });

  /// Checks if this binding matches the given key event
  bool matches(KeyEvent event) {
    if (event.logicalKey != key) return false;

    final keyboard = HardwareKeyboard.instance;
    if (ctrl != keyboard.isControlPressed) return false;
    if (shift != keyboard.isShiftPressed) return false;
    if (alt != keyboard.isAltPressed) return false;
    if (meta != keyboard.isMetaPressed) return false;

    return true;
  }
}

/// Handles keyboard input for the editor
class KeyHandler {
  final List<KeyBinding> _bindings = [];

  KeyHandler() {
    _registerDefaultBindings();
  }

  void _registerDefaultBindings() {
    // Undo: Cmd/Ctrl + Z
    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyZ,
        meta: true,
        description: 'Undo',
        action: (state) {
          state.undo();
          return KeyHandleResult.handled;
        },
      ),
    );

    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyZ,
        ctrl: true,
        description: 'Undo',
        action: (state) {
          state.undo();
          return KeyHandleResult.handled;
        },
      ),
    );

    // Redo: Cmd/Ctrl + Shift + Z
    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyZ,
        meta: true,
        shift: true,
        description: 'Redo',
        action: (state) {
          state.redo();
          return KeyHandleResult.handled;
        },
      ),
    );

    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyZ,
        ctrl: true,
        shift: true,
        description: 'Redo',
        action: (state) {
          state.redo();
          return KeyHandleResult.handled;
        },
      ),
    );

    // Redo: Cmd/Ctrl + Y (alternative)
    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyY,
        meta: true,
        description: 'Redo',
        action: (state) {
          state.redo();
          return KeyHandleResult.handled;
        },
      ),
    );

    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyY,
        ctrl: true,
        description: 'Redo',
        action: (state) {
          state.redo();
          return KeyHandleResult.handled;
        },
      ),
    );

    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.keyA,
        meta: true,
        description: 'Select All',
        action: (state) {
          state.selectAllBlocks();
          return KeyHandleResult.handled;
        },
      ),
    );

    _bindings.add(
      KeyBinding(
        key: LogicalKeyboardKey.escape,
        description: 'Clear selection',
        action: (state) {
          state.clearBlockSelection();
          return KeyHandleResult.handled;
        },
      ),
    );
  }

  /// Registers a custom key binding
  void register(KeyBinding binding) {
    _bindings.insert(0, binding); // Custom bindings take priority
  }

  /// Handles a key event
  KeyHandleResult handle(KeyEvent event, EditorState state) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyHandleResult.ignored;
    }

    for (final binding in _bindings) {
      if (binding.matches(event)) {
        return binding.action(state);
      }
    }

    return KeyHandleResult.ignored;
  }
}
