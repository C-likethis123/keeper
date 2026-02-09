import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useEditorState } from './core/EditorState';
import { blockRegistry, BlockConfig } from './blocks/BlockRegistry';
import { BlockType } from './core/BlockNode';

export interface HybridEditorProps {
  initialContent?: string;
  onChanged?: (markdown: string) => void;
  autofocus?: boolean;
  onFocusedBlockChange?: (blockInfo: {
    blockType: BlockType | null;
    blockIndex: number | null;
    listLevel: number;
    onIndent: () => void;
    onOutdent: () => void;
  }) => void;
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
  onFocusedBlockChange,
}: HybridEditorProps) {
  const editorState = useEditorState();
  const lastInitialContentRef = useRef<string | undefined>(undefined);
  const isInitializedRef = useRef(false);
  const ignoreNextContentChangeRef = useRef<number | null>(null);

  // Initialize document from markdown when initialContent changes (only from outside, not from our own updates)
  useEffect(() => {
    // Only reload if initialContent prop actually changed from outside
    // Don't reload if it's the same as what we last loaded (prevents feedback loop)
    if (initialContent !== undefined && initialContent !== lastInitialContentRef.current) {
      const currentMarkdown = editorState.toMarkdown();
      // Only reload if content actually changed to avoid unnecessary re-renders
      if (currentMarkdown !== initialContent) {
        editorState.loadMarkdown(initialContent);
        lastInitialContentRef.current = initialContent;
        isInitializedRef.current = true;
      }
    }
  }, [initialContent]); // Removed editorState from dependencies to prevent feedback loop

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
      if (ignoreNextContentChangeRef.current === index) {
        ignoreNextContentChangeRef.current = null;
        return;
      }
      editorState.updateBlockContent(index, content);
    },
    [editorState],
  );

  const handleBlockTypeChange = useCallback(
    (index: number, newType: BlockType, language?: string) => {
      editorState.updateBlockType(index, newType, language);
      requestAnimationFrame(() => {
        setTimeout(() => {
          editorState.setFocusedBlock(index, false);
        }, 50);
      });
    },
    [editorState],
  );

  const handleDelete = useCallback(
    (index: number) => {
      editorState.deleteBlock(index);
      requestAnimationFrame(() => {
        editorState.setFocusedBlock(index > 0 ? index - 1 : 0);
      });
    },
    [editorState],
  );

  const handleSpace = useCallback(
    (index: number) => () => {
      const block = editorState.document.blocks[index];
      // Get current content and add space (space key was just pressed)
      const newContent = block.content + ' ';
      const detection = blockRegistry.detectBlockType(newContent);

      if (detection) {
        editorState.updateBlockType(index, detection.type, detection.language);
        editorState.updateBlockContent(index, detection.remainingContent);
        ignoreNextContentChangeRef.current = index;
        
        requestAnimationFrame(() => {
          setTimeout(() => {
            editorState.setFocusedBlock(index, false);
          }, 50);
        });
      } else {
        editorState.updateBlockContent(index, newContent);
      }
    },
    [editorState],
  );

  const handleBackspaceAtStart = useCallback(
    (index: number) => () => {
      const block = editorState.document.blocks[index];

      // If it's a non-paragraph block (except code block), convert to paragraph
      if (block.type !== BlockType.paragraph && block.type !== BlockType.codeBlock) {
        editorState.updateBlockType(index, BlockType.paragraph);
        
        // Preserve focus after block type change - use requestAnimationFrame to ensure
        // the new component (e.g., ParagraphBlock) is mounted before focusing
        requestAnimationFrame(() => {
          setTimeout(() => {
            editorState.setFocusedBlock(index, false);
          }, 50);
        });
        return;
      }

      // If it's an empty paragraph, delete and focus previous
      if (block.content === '' && index > 0) {
        editorState.deleteBlock(index);
        // Focus previous block
        requestAnimationFrame(() => {
          editorState.setFocusedBlock(index - 1);
        });
        return;
      }

      // Merge with previous block if at start
      if (index > 0) {
        editorState.mergeWithPrevious(index);
        requestAnimationFrame(() => {
          editorState.setFocusedBlock(index - 1);
        });
      }
    },
    [editorState],
  );

  const handleEnter = useCallback(
    (index: number, cursorOffset: number) => {
      const block = editorState.document.blocks[index];

      // Let code blocks handle newlines internally
      if (block.type === BlockType.codeBlock) {
        return;
      }

      // Optional: final block type detection on Enter (parity with Flutter)
      const detection = blockRegistry.detectBlockType(block.content);
      if (detection && block.type !== detection.type) {
        editorState.updateBlockType(index, detection.type, detection.language);
        editorState.updateBlockContent(index, detection.remainingContent);

        // Preserve focus on the same block after type change
        requestAnimationFrame(() => {
          setTimeout(() => {
            editorState.setFocusedBlock(index, false);
          }, 50);
        });

        return;
      }

      // Default behavior: split the block at the cursor and focus the new block
      editorState.splitBlock(index, cursorOffset);

      requestAnimationFrame(() => {
        setTimeout(() => {
          editorState.setFocusedBlock(index + 1, false);
        }, 50);
      });
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

  const calculateListItemNumber = useCallback(
    (index: number): number | undefined => {
      const block = editorState.document.blocks[index];
      if (block.type !== BlockType.numberedList) {
        return undefined;
      }

      const listLevel = block.listLevel;
      // Count consecutive numbered lists before this one
      let number = 1;
      for (let i = index - 1; i >= 0; i--) {
        const prevBlock = editorState.document.blocks[i];
        if (
          prevBlock.type !== BlockType.numberedList ||
          prevBlock.listLevel < listLevel
        ) {
          break;
        }
        if (
          prevBlock.type === BlockType.numberedList &&
          prevBlock.listLevel === listLevel
        ) {
          number++;
        }
      }
      return number;
    },
    [editorState.document.blocks],
  );

  const handleIndent = useCallback(
    (index: number) => {
      const block = editorState.document.blocks[index];
      if (block.type === BlockType.bulletList || block.type === BlockType.numberedList) {
        editorState.updateBlockListLevel(index, block.listLevel + 1);
      }
    },
    [editorState],
  );

  const handleOutdent = useCallback(
    (index: number) => {
      const block = editorState.document.blocks[index];
      if (
        (block.type === BlockType.bulletList || block.type === BlockType.numberedList) &&
        block.listLevel > 0
      ) {
        editorState.updateBlockListLevel(index, block.listLevel - 1);
      }
    },
    [editorState],
  );

  useEffect(() => {
    if (onFocusedBlockChange) {
      const focusedIndex = editorState.focusedBlockIndex;
      if (focusedIndex !== null) {
        const block = editorState.document.blocks[focusedIndex];
        onFocusedBlockChange({
          blockType: block.type,
          blockIndex: focusedIndex,
          listLevel: block.listLevel,
          onIndent: () => handleIndent(focusedIndex),
          onOutdent: () => handleOutdent(focusedIndex),
        });
      } else {
        onFocusedBlockChange({
          blockType: null,
          blockIndex: null,
          listLevel: 0,
          onIndent: () => {},
          onOutdent: () => {},
        });
      }
    }
  }, [editorState.focusedBlockIndex, editorState.document.blocks, onFocusedBlockChange, handleIndent, handleOutdent]);

  const renderBlock = useCallback(
    (block: typeof editorState.document.blocks[0], index: number) => {
      const listItemNumber = calculateListItemNumber(index);
      const config: BlockConfig = {
        block,
        index,
        isFocused: editorState.focusedBlockIndex === index,
        onContentChange: handleContentChange(index),
        onBlockTypeChange: (blockIndex: number, newType: BlockType, language?: string) => {
          if (blockIndex === index) {
            handleBlockTypeChange(index, newType, language);
          }
        },
        onBackspaceAtStart: handleBackspaceAtStart(index),
        onSpace: handleSpace(index),
        onEnter: (cursorOffset) => handleEnter(index, cursorOffset),
        onFocus: handleFocus(index),
        onBlur: handleBlur,
        onDelete: () => handleDelete(index),
        listItemNumber,
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
      handleBlockTypeChange,
      handleBackspaceAtStart,
      handleSpace,
      handleFocus,
      handleBlur,
      handleEnter,
      handleDelete,
      calculateListItemNumber,
    ],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {editorState.document.blocks.map((block, index) =>
          renderBlock(block, index),
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
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

// Enable why-did-you-render tracking for debugging
HybridEditor.displayName = 'HybridEditor';
HybridEditor.whyDidYouRender = true;

