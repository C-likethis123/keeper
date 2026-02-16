import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { useFocusBlock } from '@/hooks/useFocusBlock';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { BlockConfig } from './BlockRegistry';

interface ParagraphBlockProps extends BlockConfig { }

export const ParagraphBlock = ({
  block,
  index,
  onContentChange,
  onSpace,
  onSelectionChange,

}: ParagraphBlockProps) => {
  const { focusBlock, blurBlock, focusBlockIndex } = useFocusBlock();
  const isFocused = focusBlockIndex === index;
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  console.log('focusBlockIndex', focusBlockIndex);

  const handleContentChange = useCallback((newText: string) => {
    onContentChange(newText);
  }, [onContentChange]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e.nativeEvent.key;
    if (key === ' ') {
      onSpace?.();
    }
  }, [onSpace]);

  const handleSelectionChange = useCallback((e: any) => {
    onSelectionChange(e.nativeEvent.selection.start, e.nativeEvent.selection.end);
  }, []);
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
      onPress={() => focusBlock(index)}
    >
      <View style={[styles.overlay, isFocused ? styles.inputHidden : styles.inputFocused]} pointerEvents="none">
        <InlineMarkdown text={block.content} style={styles.baseStyle} />
      </View>
      <TextInput
        style={[styles.input, styles.baseStyle, isFocused ? styles.inputFocused : styles.inputHidden]}
        value={block.content}
        onChangeText={handleContentChange}
        onFocus={() => focusBlock(index)}
        onBlur={() => blurBlock()}
        onKeyPress={handleKeyPress}
        onSelectionChange={handleSelectionChange}
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
