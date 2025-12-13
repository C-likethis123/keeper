/// Hybrid Editor - A markdown editor with embedded code editor support
/// 
/// This library provides a block-based text editor that combines:
/// - Markdown editing with live formatting
/// - Full-featured code blocks with syntax highlighting
/// - Smart editing features (auto-indent, brace completion)
/// - Undo/redo support
/// 
/// Usage:
/// ```dart
/// HybridEditor(
///   initialContent: '# Hello World\n\nStart writing...',
///   onChanged: (markdown) => print(markdown),
/// )
/// ```

library;

// Core
export 'core/core.dart';

// Blocks
export 'blocks/blocks.dart';

// Code Engine
export 'code_engine/code_engine.dart';

// Input
export 'input/input.dart';

// Main widget
export 'hybrid_editor.dart';

