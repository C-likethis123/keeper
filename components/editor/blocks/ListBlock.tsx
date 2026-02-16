import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { useFocusBlock } from '@/hooks/useFocusBlock';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextStyle, View } from 'react-native';
import { BlockType } from '../core/BlockNode';
import { InlineMarkdown } from '../rendering/InlineMarkdown';
import { WikiLinkTrigger } from '../wikilinks/WikiLinkTrigger';
import { BlockConfig } from './BlockRegistry';
import { ListMarker } from './ListMarker';

export function ListBlock({
  block,
  index,
  isFocused,
  onContentChange,
  onBackspaceAtStart,
  onSpace,
  onEnter,
  onSelectionChange,
  listItemNumber,
  onWikiLinkTriggerStart,
  onWikiLinkQueryUpdate,
  onWikiLinkTriggerEnd,
}: BlockConfig) {
  const inputRef = useRef<TextInput>(null);
  const { focusBlock, blurBlock, focusBlockIndex } = useFocusBlock();
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

  const handleBlur = useCallback(() => {
    blurBlock();
    // End wiki link session on blur, but with a delay to allow overlay selection
    setTimeout(() => {
      onWikiLinkTriggerEnd?.();
    }, 150);
  }, [blurBlock, onWikiLinkTriggerEnd]);


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
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false;
        return;
      }
      onContentChange(newText);

      // Detect wiki link triggers after content change
      requestAnimationFrame(() => {
        if (isFocused && inputRef.current) {
          const caret = selection.start;
          const start = WikiLinkTrigger.findStart(newText, caret);

          if (start !== null) {
            onWikiLinkTriggerStart?.(start);
            const query = newText.substring(start + 2, caret);
            onWikiLinkQueryUpdate?.(query, caret);
          } else {
            onWikiLinkTriggerEnd?.();
          }
        }
      });
    },
    [onContentChange, isFocused, selection.start, onWikiLinkTriggerStart, onWikiLinkQueryUpdate, onWikiLinkTriggerEnd],
  );

  const handleKeyPress = useCallback(
    (e: any) => {
      const key = e.nativeEvent.key;

      if ((key === 'Enter' || key === 'Return') && selection.start === selection.end) {
        if (block.type !== BlockType.codeBlock) {
          ignoreNextChangeRef.current = true;
          onEnter?.(selection.start);
        }
        return;
      }

      if (key === 'Backspace' && selection.start === 0 && selection.end === 0) {
        if (block.type === BlockType.bulletList || block.type === BlockType.numberedList) {
          onBackspaceAtStart?.();
        }
        return;
      }
    },
    [onEnter, onBackspaceAtStart, selection, block.type],
  );

  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const textStyle: TextStyle = useMemo(() => theme.typography.body, [theme.typography]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isFocused && styles.focused,
        pressed && styles.pressed,
      ]}
      onPress={() => focusBlock(index)}
    >
      <View style={styles.row}>
        <ListMarker
          type={block.type as BlockType.bulletList | BlockType.numberedList}
          listLevel={block.listLevel}
          listItemNumber={listItemNumber}
        />
        <View style={styles.contentContainer}>
          <TextInput
            ref={inputRef}
            pointerEvents={isFocused ? 'auto' : 'none'}
            style={[
              styles.input,
              textStyle,
              isFocused ? styles.inputVisible : styles.inputHidden,
              !isFocused && styles.inputBehindOverlay,
            ]}
            value={block.content}
            onChangeText={handleContentChange}
            onFocus={() => focusBlock(index)}
            onBlur={handleBlur}
            onKeyPress={handleKeyPress}
            onSelectionChange={handleSelectionChange}
            multiline
            placeholder="List item..."
            placeholderTextColor={theme.custom.editor.placeholder}
          />
          {!isFocused && (
            <Pressable style={styles.overlay} onPress={() => focusBlock(index)} pointerEvents="auto">
              <View style={styles.overlayContent}>
                <InlineMarkdown text={block.content} style={textStyle} />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      minHeight: 40,
      paddingHorizontal: 16,
      position: 'relative',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
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
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      pointerEvents: 'box-none',
      zIndex: 10,
      justifyContent: 'center',
    },
    inputBehindOverlay: {
      zIndex: 0,
    },
    overlayContent: {
      minHeight: 24,
      justifyContent: 'center',
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
  });
}

