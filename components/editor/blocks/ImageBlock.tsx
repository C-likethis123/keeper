import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { useFocusBlock } from '@/hooks/useFocusBlock';
import { NOTES_ROOT } from '@/services/notes/Notes';
import { Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { BlockConfig } from './BlockRegistry';

function resolveImageUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return Paths.join(NOTES_ROOT, path);
}

// TODO: maybe integrate this with the UnifiedBlock?
export function ImageBlock({ block, index, isFocused, onEnter, onContentChange, onBackspaceAtStart, onSelectionChange }: BlockConfig) {
  const { focusBlock } = useFocusBlock();
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const uri = resolveImageUri(block.content);
  const handleKeyPress = useCallback(
    (e: any) => {
      const key = e.nativeEvent.key;
      if ((key === 'Enter') && selection.start === selection.end) {
        onEnter(selection.start);
      }

      if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
        onBackspaceAtStart();
        return;
      }
    },
    [onBackspaceAtStart, selection],
  );

  const handleSelectionChange = useCallback(
    (e: any) => {
      setSelection(e.nativeEvent.selection);
      onSelectionChange(e.nativeEvent.selection.start, e.nativeEvent.selection.end);
    },
    [onSelectionChange],
  );
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={() => focusBlock(index)}
    >
      {!isFocused && <Image source={{ uri }} style={styles.image} contentFit="contain" />}
      <TextInput style={[styles.input, isFocused ? styles.inputVisible : styles.inputHidden]} value={block.content} onChangeText={onContentChange} onKeyPress={handleKeyPress} onSelectionChange={handleSelectionChange} />
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingHorizontal: 16,
      paddingVertical: 8,
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
    focused: {
      backgroundColor: theme.custom.editor.blockFocused,
    },
    pressed: {
      opacity: 0.8,
    },
    image: {
      width: '100%',
      maxWidth: 400,
      minHeight: 100,
      borderRadius: 4,
    },
  });
}
