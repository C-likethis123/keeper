import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { BlockNode } from '../core/BlockNode';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface BlockRendererProps {
  block: BlockNode;
  index: number;
  isFocused?: boolean;
}

/// Basic block renderer component
/// This is a placeholder that will be extended in later phases
export function BlockRenderer({
  block,
  index,
  isFocused,
}: BlockRendererProps) {
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. This is for visual feedback when the user taps/clicks the block.
      style={({ pressed }) => [
        styles.block,
        pressed && styles.pressedBlock,
        isFocused && styles.blockFocused
      ]}
    >
      <Text style={styles.blockContent}>{block.content || ' '}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useExtendedTheme>) => StyleSheet.create({
  block: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 40,
    backgroundColor: theme.custom.editor.blockBackground
  },
  pressedBlock: {
    opacity: 0.8,
  },
  blockFocused: {
    backgroundColor: theme.custom.editor.blockFocused,
  },
  blockContent: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
  },
});

