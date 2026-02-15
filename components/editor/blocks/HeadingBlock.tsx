import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface HeadingBlockProps extends BlockConfig {
  level: 1 | 2 | 3;
}

export function HeadingBlock({
  block,
  index,
  onContentChange,
  onBackspaceAtStart,
  onFocus,
  onBlur,
  isFocused: isFocusedFromState,
  level,
}: HeadingBlockProps) {
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

    // Handle backspace at the start (position 0) - convert to paragraph
    // This matches Flutter's behavior where backspace at start converts heading to paragraph
    if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
      onBackspaceAtStart?.();
      return;
    }
  }, [onBackspaceAtStart, selection]);

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headingStyle: TextStyle = useMemo(() => {
    switch (level) {
      case 1:
        return theme.typography.heading1;
      case 2:
        return theme.typography.heading2;
      case 3:
        return theme.typography.heading3;
    }
  }, [level, theme.typography]);

  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. Keyboard focus is handled separately via TextInput's
      // onFocus/onBlur events and the `isFocused` state.
      style={({ pressed }) => [
        styles.container,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={handleFocus}
    >
      {/* Rendered markdown overlay (when not focused) - conditionally render */}
      <View style={[styles.overlay, isFocused ? styles.inputHidden : styles.inputFocused]} pointerEvents="none">
        <InlineMarkdown text={block.content} style={headingStyle} />
      </View>

      {/* Editable text input - only show when focused */}
      <TextInput
        ref={inputRef}
        style={[styles.input, headingStyle, isFocused ? styles.inputFocused : styles.inputHidden]}
        value={block.content}
        onChangeText={handleContentChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        onSelectionChange={handleSelectionChange}
        multiline
        textAlignVertical="top"
        placeholder={`Heading ${level}...`}
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
      paddingVertical: 12,
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
      top: 12,
      left: 16,
      right: 16,
      pointerEvents: 'none',
      zIndex: 1,
    },
    input: {
      minHeight: 24,
    },
    inputFocused: {
      color: theme.colors.text,
      visibility: 'visible',
    },
    inputHidden: {
      display: 'none',
    }
  });
}

// Enable why-did-you-render tracking for debugging
// HeadingBlock.displayName = 'HeadingBlock';
// HeadingBlock.whyDidYouRender = true;
