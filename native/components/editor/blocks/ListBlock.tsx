import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { BlockType } from '../core/BlockNode';
import { ListMarker } from './ListMarker';

export function ListBlock({
  block,
  onContentChange,
  onBackspaceAtStart,
  onSpace,
  onEnter,
  onFocus,
  onBlur,
  isFocused: isFocusedFromState,
  listItemNumber,
}: BlockConfig) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const ignoreNextChangeRef = useRef(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  useEffect(() => {
    if (isFocusedFromState && inputRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      });
    }
  }, [isFocusedFromState]);

  const handleSelectionChange = useCallback((e: any) => {
    setSelection({
      start: e.nativeEvent.selection.start,
      end: e.nativeEvent.selection.end,
    });
  }, []);

  const handleContentChange = useCallback(
    (newText: string) => {
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false;
        return;
      }
      onContentChange(newText);
    },
    [onContentChange],
  );

  const handleKeyPress = useCallback(
    (e: any) => {
      const key = e.nativeEvent.key;

      if ((key === 'Enter' || key === 'Return') && selection.start === selection.end) {
        if (block.type !== BlockType.codeBlock) {
          ignoreNextChangeRef.current = true;
          onEnter?.(selection.start);
        }
        return;
      }

      if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
        if (block.type === BlockType.bulletList || block.type === BlockType.numberedList) {
          onBackspaceAtStart?.();
        }
        return;
      }
    },
    [onEnter, onBackspaceAtStart, selection, block.type],
  );

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const textStyle: TextStyle = useMemo(() => theme.typography.body, [theme.typography]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={handleFocus}
    >
      <View style={styles.row}>
        <ListMarker
          type={block.type as BlockType.bulletList | BlockType.numberedList}
          listLevel={block.listLevel}
          listItemNumber={listItemNumber}
        />
        <View style={styles.contentContainer}>
          {!isFocused && (
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.overlayContent}>
                <InlineMarkdown text={block.content} style={textStyle} />
              </View>
            </View>
          )}

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
            textAlignVertical="center"
            placeholder="List item..."
            placeholderTextColor={theme.custom.editor.placeholder}
          />
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 16,
      position: 'relative',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
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
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: 1,
      justifyContent: 'center',
    },
    overlayContent: {
      minHeight: 24,
      justifyContent: 'center',
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
    },
  });
}

