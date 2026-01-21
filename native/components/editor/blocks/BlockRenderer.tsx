import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { BlockNode } from '../core/BlockNode';

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
  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. This is for visual feedback when the user taps/clicks the block.
      style={({ pressed }) => [
        styles.block,
        pressed && styles.pressedBlock,
      ]}
    >
      <Text style={styles.blockContent}>{block.content || ' '}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  focusedBlock: {
    backgroundColor: '#f0f0f0',
  },
  pressedBlock: {
    opacity: 0.8,
  },
  blockContent: {
    fontSize: 16,
    lineHeight: 24,
  },
});

