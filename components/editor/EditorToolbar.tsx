import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
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

  if (Platform.OS === 'web') {
    return null;
  }

  const isListBlock =
    blockType === BlockType.bulletList || blockType === BlockType.numberedList;
  const shouldShow = isListBlock && blockIndex !== null;

  if (!shouldShow) {
    return null;
  }

  const canOutdent = listLevel > 0;

  return (
    <View style={styles.toolbar}>
      <TouchableOpacity
        style={[styles.button, !canOutdent && styles.buttonDisabled]}
        onPress={onOutdent}
        disabled={!canOutdent}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="format-indent-decrease"
          size={24}
          color={canOutdent ? theme.colors.text : theme.colors.text + '40'}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={onIndent}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="format-indent-increase"
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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

