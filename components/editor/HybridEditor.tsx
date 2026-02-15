import React, { useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useEditorState } from './core/EditorState';
import { blockRegistry, BlockConfig } from './blocks/BlockRegistry';
import { BlockType } from './core/BlockNode';
import { WikiLinkOverlay } from './wikilinks/WikiLinkOverlay';
import { useWikiLinks } from './wikilinks/useWikiLinks';
import { useOverlayPosition } from '@/hooks/useOverlayPosition';
import { useFocusBlock } from '@/hooks/useFocusBlock';

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

  // Wiki link management via hook
  const wikiLinks = useWikiLinks();

  // Overlay positioning
  const overlayPosition = useOverlayPosition({
    strategy: 'center',
    zIndex: 1000,
    elevation: 10,
  });

  // Focus management
  const { focusBlock, blurBlock } = useFocusBlock();

  // Track if a selection is in progress to prevent blur from ending session
  const wikiLinkSelectionInProgressRef = useRef(false);

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

  useEffect(() => {
    if (autofocus && editorState.document.blocks.length > 0) {
      focusBlock(0, { delay: 100 });
    }
  }, [autofocus, editorState, focusBlock]);


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

  const handleBlockTypeDetection = useCallback(
    (
      index: number,
      content: string,
      options?: {
        ignoreContentChange?: boolean;
        preserveFocus?: boolean;
        focusDelay?: number;
        onlyIfTypeChanges?: boolean;
      }
    ): boolean => {
      const block = editorState.document.blocks[index];
      const detection = blockRegistry.detectBlockType(content);

      if (!detection) {
        return false;
      }

      // If onlyIfTypeChanges is true, check if type would actually change
      if (options?.onlyIfTypeChanges && block.type === detection.type) {
        return false;
      }

      // Update block type and content
      editorState.updateBlockType(index, detection.type, detection.language);
      editorState.updateBlockContent(index, detection.remainingContent);

      // Set ignore flag if requested to prevent feedback loop
      if (options?.ignoreContentChange) {
        ignoreNextContentChangeRef.current = index;
      }

      // Handle focus management
      const preserveFocus = options?.preserveFocus !== false; // Default to true
      const focusDelay = options?.focusDelay ?? 50;

      if (preserveFocus) {
        focusBlock(index, { delay: focusDelay });
      }

      return true;
    },
    [editorState, focusBlock],
  );

  const handleBlockTypeChange = useCallback(
    (index: number, newType: BlockType, language?: string) => {
      editorState.updateBlockType(index, newType, language);
      focusBlock(index);
    },
    [editorState, focusBlock],
  );

  const handleDelete = useCallback(
    (index: number) => {
      editorState.deleteBlock(index);
      focusBlock(index > 0 ? index - 1 : 0, { delay: 0, useAnimationFrame: false });
    },
    [editorState, focusBlock],
  );

  const handleSpace = useCallback(
    (index: number) => () => {
      const block = editorState.document.blocks[index];
      // Get current content and add space (space key was just pressed)
      const newContent = block.content + ' ';

      if (!handleBlockTypeDetection(index, newContent, { ignoreContentChange: true })) {
        editorState.updateBlockContent(index, newContent);
      }
    },
    [editorState, handleBlockTypeDetection],
  );

  const handleBackspaceAtStart = useCallback(
    (index: number) => () => {
      const block = editorState.document.blocks[index];

      // If it's a non-paragraph block (except code block and math block), convert to paragraph
      if (![BlockType.paragraph, BlockType.codeBlock, BlockType.mathBlock].includes(block.type)) {
        editorState.updateBlockType(index, BlockType.paragraph);
        focusBlock(index);
        return;
      }

      // If it's an empty paragraph, delete and focus previous
      if (block.content === '' && index > 0) {
        editorState.deleteBlock(index);
        focusBlock(index - 1, { delay: 0, useAnimationFrame: false });
        return;
      }

      // Merge with previous block if at start
      if (index > 0) {
        editorState.mergeWithPrevious(index);
        focusBlock(index - 1, { delay: 0, useAnimationFrame: false });
      }
    },
    [editorState],
  );

  const handleEnter = useCallback(
    (index: number, cursorOffset: number) => {
      const block = editorState.document.blocks[index];

      // Handle wiki link selection if active
      if (wikiLinks.isActiveFor(index)) {
        const selected = wikiLinks.getSelectedResult();
        if (selected) {
          wikiLinks.handleSelect(selected, index, editorState.updateBlockContent);
          return;
        }
      }

      // Let code blocks and math blocks handle newlines internally
      if ([BlockType.codeBlock, BlockType.mathBlock].includes(block.type)) {
        return;
      }

      // Optional: final block type detection on Enter (parity with Flutter)
      // Only convert if type would actually change
      if (handleBlockTypeDetection(index, block.content, { onlyIfTypeChanges: true })) {
        return; // Conversion happened, don't split
      }

      // Default behavior: split the block at the cursor and focus the new block
      // Set ignore flag before splitting to prevent TextInput from updating old block
      ignoreNextContentChangeRef.current = index;

      // Blur current block first to prevent it from processing the Enter key
      blurBlock();

      editorState.splitBlock(index, cursorOffset);

      focusBlock(index + 1, { delay: 100 });
    },
    [editorState, wikiLinks, handleBlockTypeDetection, focusBlock, blurBlock],
  );

  const handleFocus = useCallback(
    (index: number) => () => {
      focusBlock(index, { delay: 0, useAnimationFrame: false });
    },
    [focusBlock],
  );

  const handleBlur = useCallback(() => {
    // Optionally clear focus on blur
    // editorState.setFocusedBlock(null);
    // End wiki link session on blur, but with a small delay to allow overlay selection
    setTimeout(() => {
      // Don't end if a selection is in progress or already completed
      if (wikiLinkSelectionInProgressRef.current) {
        wikiLinkSelectionInProgressRef.current = false;
        return;
      }
      // Only end if still active (might have been selected already)
      // With centered overlay, we still check if overlay is visible to avoid ending during selection
      if (wikiLinks.isActive && !wikiLinks.shouldShowOverlay) {
        wikiLinks.handleTriggerEnd();
      }
    }, 200); // Delay to allow overlay onPress to fire first
  }, [wikiLinks]);

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
        onWikiLinkTriggerStart: (startOffset) => wikiLinks.handleTriggerStart(index, startOffset),
        onWikiLinkQueryUpdate: (query, caretOffset) => wikiLinks.handleQueryUpdate(index, query, caretOffset),
        onWikiLinkTriggerEnd: wikiLinks.handleTriggerEnd,
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

  const showWikiLinkOverlay = wikiLinks.shouldShowOverlay;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {editorState.document.blocks.map((block, index) => {
          const blockElement = renderBlock(block, index);
          return (
            <View key={block.id} style={styles.blockWrapper}>
              {blockElement}
            </View>
          );
        })}
      </ScrollView>
      {/* Render overlay outside ScrollView to prevent touch conflicts */}
      {showWikiLinkOverlay && wikiLinks.session && (
        <View style={overlayPosition.wrapperStyle} {...overlayPosition.wrapperProps}>
          <View style={overlayPosition.containerStyle} {...overlayPosition.containerProps}>
            <WikiLinkOverlay
              results={wikiLinks.results}
              selectedIndex={wikiLinks.selectedIndex}
              isLoading={wikiLinks.isLoading}
              onSelect={(title) => {
                wikiLinkSelectionInProgressRef.current = true;
                wikiLinks.handleSelect(title, wikiLinks.session!.blockIndex, editorState.updateBlockContent);
              }}
            />
          </View>
        </View>
      )}
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

