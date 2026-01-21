import React, { useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useEditorState } from './core/EditorState';
import { blockRegistry, BlockConfig } from './blocks/BlockRegistry';
import { getBlock } from './core/Document';

export interface HybridEditorProps {
  initialContent?: string;
  onChanged?: (markdown: string) => void;
  autofocus?: boolean;
}

/// A hybrid markdown/code editor widget
///
/// Features:
/// - Block-based editing with markdown support
/// - Inline markdown formatting (bold, italic, code, links)
/// - Keyboard shortcuts
/// - Undo/redo support
export function HybridEditor({
  initialContent = '',
  onChanged,
  autofocus = false,
}: HybridEditorProps) {
  const editorState = useEditorState();

  // Initialize document from markdown when initialContent changes
  useEffect(() => {
    if (initialContent !== undefined) {
      const currentMarkdown = editorState.toMarkdown();
      // Only reload if content actually changed to avoid unnecessary re-renders
      if (currentMarkdown !== initialContent) {
        editorState.loadMarkdown(initialContent);
      }
    }
  }, [initialContent, editorState]);

  // Notify parent of changes
  useEffect(() => {
    if (onChanged) {
      const markdown = editorState.toMarkdown();
      onChanged(markdown);
    }
  }, [editorState.document, onChanged, editorState]);

  // Auto-focus first block - use requestAnimationFrame to ensure refs are ready
  useEffect(() => {
    if (autofocus && editorState.document.blocks.length > 0) {
      // Use requestAnimationFrame to ensure TextInput refs are mounted
      requestAnimationFrame(() => {
        setTimeout(() => {
          editorState.setFocusedBlock(0, false);
        }, 100);
      });
    }
  }, [autofocus, editorState]);

  const handleContentChange = useCallback(
    (index: number) => (content: string) => {
      editorState.updateBlockContent(index, content);
    },
    [editorState],
  );

  const handleFocus = useCallback(
    (index: number) => () => {
      editorState.setFocusedBlock(index);
    },
    [editorState],
  );

  const handleBlur = useCallback(() => {
    // Optionally clear focus on blur
    // editorState.setFocusedBlock(null);
  }, []);

  const renderBlock = useCallback(
    (block: typeof editorState.document.blocks[0], index: number) => {
      const config: BlockConfig = {
        block,
        index,
        isFocused: editorState.focusedBlockIndex === index,
        onContentChange: handleContentChange(index),
        onFocus: handleFocus(index),
        onBlur: handleBlur,
      };

      return (
        <View key={block.id} style={styles.blockWrapper}>
          {blockRegistry.build(config)}
        </View>
      );
    },
    [
      editorState.document.blocks,
      editorState.focusedBlockIndex,
      handleContentChange,
      handleFocus,
      handleBlur,
    ],
  );

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {editorState.document.blocks.map((block, index) =>
        renderBlock(block, index),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  blockWrapper: {
    width: '100%',
  },
});

