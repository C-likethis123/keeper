import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlockNode } from '../core/BlockNode';

interface BlockRendererProps {
  block: BlockNode;
  index: number;
  isFocused?: boolean;
  isSelected?: boolean;
}

/// Basic block renderer component
/// This is a placeholder that will be extended in later phases
export function BlockRenderer({
  block,
  index,
  isFocused = false,
  isSelected = false,
}: BlockRendererProps) {
  return (
    <View
      style={[
        styles.block,
        isFocused && styles.focusedBlock,
        isSelected && styles.selectedBlock,
      ]}
    >
      <Text style={styles.blockContent}>{block.content || ' '}</Text>
    </View>
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
  selectedBlock: {
    backgroundColor: '#e0e0ff',
  },
  blockContent: {
    fontSize: 16,
    lineHeight: 24,
  },
});

