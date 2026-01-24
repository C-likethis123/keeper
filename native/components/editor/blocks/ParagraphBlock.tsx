import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface ParagraphBlockProps extends BlockConfig { }

export const ParagraphBlock = ({
  block,
  index,
  onContentChange,
}: ParagraphBlockProps) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => setIsFocused(true), []);

  const handleBlur = useCallback(() => setIsFocused(false), []);

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <InlineMarkdown text={block.content} style={styles.baseStyle} />
      </View>

      {/* Editable text input - only show when focused */}
      <TextInput
        ref={inputRef}
        style={[styles.input, styles.baseStyle, isFocused ? styles.inputFocused : styles.inputHidden]}
        value={block.content}
        onChangeText={onContentChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        textAlignVertical="top"
        placeholder="Start typing..."
        placeholderTextColor={theme.custom.editor.placeholder}
      />
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
    baseStyle: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 24,
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
    inputHidden: {
      display: 'none',
    },
    inputFocused: {
      color: theme.colors.text,
      visibility: 'visible',
    },
  });
}

// Enable why-did-you-render tracking for debugging
// ParagraphBlock.displayName = 'ParagraphBlock';
// ParagraphBlock.whyDidYouRender = true;
