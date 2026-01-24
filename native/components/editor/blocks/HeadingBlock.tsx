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
  level,
}: HeadingBlockProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => setIsFocused(true), []);

  const handleBlur = useCallback(() => setIsFocused(false), []);


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
          onChangeText={onContentChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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

