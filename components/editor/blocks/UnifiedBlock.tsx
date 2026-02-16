import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Pressable, TextInput, StyleSheet, TextStyle, View } from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { BlockType } from '../core/BlockNode';
import { WikiLinkTrigger } from '../wikilinks/WikiLinkTrigger';

export function UnifiedBlock({
  block,
  onContentChange,
  onBackspaceAtStart,
  onSpace,
  onEnter,
  onFocus,
  onBlur,
  onSelectionChange,
  isFocused: isFocusedFromState,
  onWikiLinkTriggerStart,
  onWikiLinkQueryUpdate,
  onWikiLinkTriggerEnd,
}: BlockConfig) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const ignoreNextChangeRef = useRef(false);
  const lastBlockContentRef = useRef(block.content);

  // Sync TextInput when block content changes externally (e.g., from wiki link selection)
  useEffect(() => {
    if (block.content !== lastBlockContentRef.current && inputRef.current) {
      // Block content changed externally - update TextInput
      lastBlockContentRef.current = block.content;
      // Force update by setting native props
      if (inputRef.current) {
        inputRef.current.setNativeProps({ text: block.content });
        // Also update selection to end of new content
        inputRef.current.setNativeProps({
          selection: { start: block.content.length, end: block.content.length }
        });
      }
    }
  }, [block.content]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // End wiki link session on blur, but with a delay to allow overlay selection
    // The delay gives the overlay's onPress time to fire before ending the session
    setTimeout(() => {
      onWikiLinkTriggerEnd?.();
    }, 150);
    onBlur?.();
  }, [onBlur, onWikiLinkTriggerEnd]);

  // Auto-focus TextInput when block becomes focused (e.g., after block type change)
  useEffect(() => {
    if (isFocusedFromState && inputRef.current) {
      // Use requestAnimationFrame to ensure TextInput is mounted
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      });
    }
  }, [isFocusedFromState]);

  const handleSelectionChange = useCallback(
    (e: any) => {
      const newSelection = {
        start: e.nativeEvent.selection.start,
        end: e.nativeEvent.selection.end,
      };
      setSelection(newSelection);
      onSelectionChange?.(newSelection.start, newSelection.end);

      if (isFocused && newSelection.start === newSelection.end) {
        const caret = newSelection.start;
        const triggerStart = WikiLinkTrigger.findStart(block.content, caret);

        if (triggerStart !== null) {
          onWikiLinkTriggerStart?.(triggerStart);
          const query = block.content.substring(triggerStart + 2, caret);
          onWikiLinkQueryUpdate?.(query, caret);
        } else {
          onWikiLinkTriggerEnd?.();
        }
      }
    },
    [
      isFocused,
      block.content,
      onSelectionChange,
      onWikiLinkTriggerStart,
      onWikiLinkQueryUpdate,
      onWikiLinkTriggerEnd,
    ],
  );

  const handleContentChange = useCallback(
    (newText: string) => {
      // Update ref to track current content
      lastBlockContentRef.current = newText;
      // When we handle Enter to split the block, React Native's TextInput will still
      // emit an onChangeText with a newline. We want to ignore that one change,
      // because the actual split is handled via EditorState.splitBlock.
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false;
        return;
      }

      // In Flutter's approach, TextInput shows content without prefix
      // So we just update the content directly
      onContentChange(newText);

      // Detect wiki link triggers after content change
      // Use requestAnimationFrame to ensure selection is updated
      if (isFocused && inputRef.current) {
        // Get current selection from the input
        // Note: We can't reliably get selection here, so we'll rely on onSelectionChange
        // But we can still check for triggers in the new text
        const caret = selection.start; // Use last known selection
        const start = WikiLinkTrigger.findStart(newText, caret);

        if (start !== null) {
          onWikiLinkTriggerStart?.(start);
          const query = newText.substring(start + 2, caret);
          onWikiLinkQueryUpdate?.(query, caret);
        } else {
          onWikiLinkTriggerEnd?.();
        }
      }
    },
    [onContentChange, isFocused, selection.start, onWikiLinkTriggerStart, onWikiLinkQueryUpdate, onWikiLinkTriggerEnd],
  );

  const handleKeyPress = useCallback(
    (e: any) => {
      const key = e.nativeEvent.key;

      // Handle space key - trigger block type detection for paragraph blocks
      if (key === ' ' && block.type === BlockType.paragraph) {
        onSpace?.();
        return;
      }

      // Handle Enter key - split non-code blocks at the current cursor position
      if ((key === 'Enter' || key === 'Return') && selection.start === selection.end) {
        if (block.type !== BlockType.codeBlock) {
          // Mark the next onChangeText as ignorable so the stray newline doesn't
          // get written back into the original block after we split.
          ignoreNextChangeRef.current = true;
          onEnter?.(selection.start);
        }
        return;
      }

      // Handle backspace at the start (position 0)
      if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
        // Paragraph blocks: if empty, delegate to editor-level handler to delete
        if (block.type === BlockType.paragraph) {
          if (block.content === '') {
            onBackspaceAtStart?.();
          }
          // For non-empty paragraphs we currently don't merge; keep behavior as-is.
          return;
        }

        // Non-paragraph, non-code blocks (e.g., headings): convert to paragraph
        if (block.type !== BlockType.codeBlock) {
          onBackspaceAtStart?.();
        }
        return;
      }
    },
    [onSpace, onEnter, onBackspaceAtStart, selection, block.type, block.content],
  );

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Compute text style based on block type
  const textStyle: TextStyle = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
        return theme.typography.heading1;
      case BlockType.heading2:
        return theme.typography.heading2;
      case BlockType.heading3:
        return theme.typography.heading3;
      default:
        return theme.typography.body;
    }
  }, [block.type, theme.typography]);

  // Compute container padding and overlay top position based on block type
  const containerPadding = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
      case BlockType.heading2:
      case BlockType.heading3:
        return { paddingVertical: 12 };
      default:
        return { paddingVertical: 4 };
    }
  }, [block.type]);

  const overlayTop = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
      case BlockType.heading2:
      case BlockType.heading3:
        return 12;
      default:
        return 4;
    }
  }, [block.type]);

  // Placeholder text based on block type
  const placeholder = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
        return 'Heading 1...';
      case BlockType.heading2:
        return 'Heading 2...';
      case BlockType.heading3:
        return 'Heading 3...';
      default:
        return 'Start typing...';
    }
  }, [block.type]);

  return (
    <Pressable
      // Note: `pressed` in Pressable style callback refers to touch/mouse press state,
      // NOT keyboard focus. Keyboard focus is handled separately via TextInput's
      // onFocus/onBlur events and the `isFocused` state.
      style={({ pressed }) => [
        styles.container,
        containerPadding,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={handleFocus}
    >
      {/* Rendered markdown overlay (when not focused) - conditionally render */}
      {!isFocused && (
        <View style={[styles.overlay, { top: overlayTop }]} pointerEvents="none">
          <InlineMarkdown text={block.content} style={textStyle} />
        </View>
      )}

      {/* Editable text input - always rendered, visible when focused */}
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
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={theme.custom.editor.placeholder}
      />
    </Pressable>
  );
}

// Styles are created dynamically based on theme
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingHorizontal: 16,
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
      left: 16,
      right: 16,
      pointerEvents: 'none',
      zIndex: 1,
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
      // Keep TextInput in layout so it's still clickable
      // The overlay will cover it visually, but clicks go through (pointerEvents: 'none')
    },
  });
}

