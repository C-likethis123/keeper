import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlockType } from './core/BlockNode';

interface EditorToolbarProps {
  blockType: BlockType | null;
  blockIndex: number | null;
  listLevel: number;
  onIndent: () => void;
  onOutdent: () => void;
}

export function EditorToolbar({
  blockType,
  blockIndex,
  listLevel,
  onIndent,
  onOutdent,
}: EditorToolbarProps) {
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isListBlock =
    blockType === BlockType.bulletList || blockType === BlockType.numberedList;

  const canOutdent = isListBlock && listLevel > 0;
  const canIndent = isListBlock && listLevel < 10;

  return (
    <View style={styles.toolbar}>
      <TouchableOpacity
        style={styles.button}
        onPress={onIndent}
        activeOpacity={0.7}
        disabled={!canIndent}
      >
        <MaterialIcons
          name="format-indent-increase"
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, !canOutdent && styles.buttonDisabled]}
        onPress={onOutdent}
        disabled={!canOutdent}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="format-indent-decrease"
          size={24}
          color={canOutdent ? theme.colors.text : theme.colors.textDisabled}
        />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 12,
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
  });
}

