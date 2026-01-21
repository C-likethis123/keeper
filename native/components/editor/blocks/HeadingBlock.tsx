import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';

interface HeadingBlockProps extends BlockConfig {
  level: 1 | 2 | 3;
}

export function HeadingBlock({
  block,
  index,
  isFocused: isFocusedFromState,
  onContentChange,
  onFocus,
  onBlur,
  level,
}: HeadingBlockProps) {
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

  const getHeadingStyle = (): TextStyle => {
    switch (level) {
      case 1:
        return {
          fontSize: 32,
          fontWeight: 'bold',
          lineHeight: 40,
          color: '#000',
        };
      case 2:
        return {
          fontSize: 24,
          fontWeight: 'bold',
          lineHeight: 32,
          color: '#000',
        };
      case 3:
        return {
          fontSize: 20,
          fontWeight: '600',
          lineHeight: 28,
          color: '#000',
        };
    }
  };

  const headingStyle = getHeadingStyle();

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
          <InlineMarkdown text={block.content} style={headingStyle} />
        </View>
      )}

      {/* Editable text input - only show when focused */}
      {isActuallyFocused && (
        <TextInput
          ref={inputRef}
          style={[styles.input, headingStyle, styles.inputFocused]}
          value={block.content}
          onChangeText={onContentChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline
          textAlignVertical="top"
          placeholder={`Heading ${level}...`}
          placeholderTextColor="#999"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  focused: {
    backgroundColor: '#f5f5f5',
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
    color: '#000',
  },
});

