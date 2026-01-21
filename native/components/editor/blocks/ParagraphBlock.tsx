import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface ParagraphBlockProps extends BlockConfig {}

export function ParagraphBlock({
  block,
  index,
  isFocused: isFocusedFromState,
  onContentChange,
  onFocus,
  onBlur,
}: ParagraphBlockProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync focus state from EditorState
  useEffect(() => {
    if (isFocusedFromState && inputRef.current) {
      // Use requestAnimationFrame to ensure ref is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isFocusedFromState]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur();
  }, [onBlur]);

  // Use combined focus state
  const isActuallyFocused = isFocused || isFocusedFromState;

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const baseStyle: TextStyle = useMemo(() => ({
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
  }), [theme.colors.text]);

  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. Keyboard focus is handled separately via TextInput's
      // onFocus/onBlur events and the `isFocused` state.
      style={({ pressed }) => [
        styles.container,
        isActuallyFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={() => {
        // Call onFocus to update EditorState first, which will cause TextInput to render
        // Then the useEffect will handle focusing the newly rendered TextInput
        onFocus();
      }}
    >
      {/* Rendered markdown overlay (when not focused) - conditionally render */}
      {!isActuallyFocused && (
        <View style={styles.overlay} pointerEvents="none">
          <InlineMarkdown text={block.content} style={baseStyle} />
        </View>
      )}

      {/* Editable text input - only show when focused */}
      {isActuallyFocused && (
        <TextInput
          ref={inputRef}
          style={[styles.input, baseStyle, styles.inputFocused]}
          value={block.content}
          onChangeText={onContentChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline
          textAlignVertical="top"
          placeholder="Start typing..."
          placeholderTextColor={theme.custom.editor.placeholder}
        />
      )}
    </Pressable>
  );
}

// Styles are created dynamically based on theme
// This is a factory function to create styles
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingVertical: 8,
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
      top: 8,
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
    },
  });
}

