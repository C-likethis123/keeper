import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig, blockRegistry } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { BlockType } from '../core/BlockNode';

export function UnifiedBlock({
  block,
  index,
  onContentChange,
  onBackspaceAtStart,
  onSpace,
  onFocus,
  onBlur,
  isFocused: isFocusedFromState,
}: BlockConfig) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Auto-focus TextInput when block becomes focused (e.g., after block type change)
  useEffect(() => {
    if (isFocusedFromState && inputRef.current) {
      // Use requestAnimationFrame to ensure TextInput is mounted
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      });
    }
  }, [isFocusedFromState]);

  const handleSelectionChange = useCallback((e: any) => {
    setSelection({
      start: e.nativeEvent.selection.start,
      end: e.nativeEvent.selection.end,
    });
  }, []);

  const handleContentChange = useCallback((newText: string) => {
    // In Flutter's approach, TextInput shows content without prefix
    // So we just update the content directly
    onContentChange(newText);
  }, [onContentChange]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e.nativeEvent.key;
    
    // Handle space key - trigger block type detection for paragraph blocks
    if (key === ' ' && block.type === BlockType.paragraph) {
      onSpace?.();
      return;
    }
    
    // Handle backspace at the start (position 0) - convert heading to paragraph
    // This matches Flutter's behavior where backspace at start converts heading to paragraph
    if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
      // Only convert if it's a heading block (not paragraph or code block)
      if (block.type !== BlockType.paragraph && block.type !== BlockType.codeBlock) {
        onBackspaceAtStart?.();
      }
      return;
    }
  }, [onSpace, onBackspaceAtStart, selection, block.type]);

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  // Compute text style based on block type
  const textStyle: TextStyle = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
        return theme.typography.heading1;
      case BlockType.heading2:
        return theme.typography.heading2;
      case BlockType.heading3:
        return theme.typography.heading3;
      default:
        return theme.typography.body;
    }
  }, [block.type, theme.typography]);

  // Compute container padding and overlay top position based on block type
  const containerPadding = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
      case BlockType.heading2:
      case BlockType.heading3:
        return { paddingVertical: 12 };
      default:
        return { paddingVertical: 8 };
    }
  }, [block.type]);

  const overlayTop = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
      case BlockType.heading2:
      case BlockType.heading3:
        return 12;
      default:
        return 8;
    }
  }, [block.type]);

  // Placeholder text based on block type
  const placeholder = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
        return 'Heading 1...';
      case BlockType.heading2:
        return 'Heading 2...';
      case BlockType.heading3:
        return 'Heading 3...';
      default:
        return 'Start typing...';
    }
  }, [block.type]);

  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. Keyboard focus is handled separately via TextInput's
      // onFocus/onBlur events and the `isFocused` state.
      style={({ pressed }) => [
        styles.container,
        containerPadding,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={handleFocus}
    >
      {/* Rendered markdown overlay (when not focused) - conditionally render */}
      {!isFocused && (
        <View style={[styles.overlay, { top: overlayTop }]} pointerEvents="none">
          <InlineMarkdown text={block.content} style={textStyle} />
        </View>
      )}

      {/* Editable text input - always rendered, visible when focused */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          textStyle,
          isFocused ? styles.inputVisible : styles.inputHidden,
        ]}
        value={block.content}
        onChangeText={handleContentChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        onSelectionChange={handleSelectionChange}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={theme.custom.editor.placeholder}
      />
    </Pressable>
  );
}

// Styles are created dynamically based on theme
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingHorizontal: 16,
      position: 'relative',
    },
    focused: {
      backgroundColor: theme.custom.editor.blockFocused,
    },
    pressed: {
      opacity: 0.8,
    },
    overlay: {
      position: 'absolute',
      left: 16,
      right: 16,
      pointerEvents: 'none',
      zIndex: 1,
    },
    input: {
      minHeight: 24,
      color: theme.colors.text,
    },
    inputVisible: {
      opacity: 1,
    },
    inputHidden: {
      opacity: 0,
      // Keep TextInput in layout so it's still clickable
      // The overlay will cover it visually, but clicks go through (pointerEvents: 'none')
    },
  });
}

