import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import TextInput from "@/components/shared/TextInput";
import { webMultilineTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useStyles } from "@/hooks/useStyles";
import { useEditorBlockSelection, useEditorState } from "@/stores/editorStore";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import type { GestureResponderEvent } from "react-native";
import {
  type NativeMethods,
  type NativeSyntheticEvent,
  type TextInput as NativeTextInput,
  Platform,
  Pressable,
  StyleSheet,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
  type TextStyle,
  View,
} from "react-native";
import { useEditorScrollView } from "../EditorScrollContext";
import { BlockType, getListLevel, isListItem } from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import { useSlashCommandContext } from "../slash-commands/SlashCommandContext";
import { findSlashCommandTriggerStart } from "../slash-commands/SlashCommandTrigger";
import { useWikiLinkContext } from "../wikilinks/WikiLinkContext";
import { findWikiLinkTriggerStart } from "../wikilinks/WikiLinkTrigger";
import {
  type WikiLinkActivationEvent,
  shouldOpenWikiLink,
  stopWikiLinkActivation,
} from "../wikilinks/wikiLinkUtils";
import type { BlockConfig } from "./BlockRegistry";
import { ListMarker } from "./ListMarker";

export function UnifiedBlock({
  block,
  index,
  isFocused,
  hasBlockSelection,
  onContentChange,
  onBackspaceAtStart,
  onSpace,
  onEnter,
  onBlockExit,
  onSelectionChange,
  listItemNumber,
  onCheckboxToggle,
  onOpenWikiLink,
  clearStructuredSelection,
}: BlockConfig) {
  const { focusBlock, focusBlockAt, blurBlock } = useFocusBlock();
  const { scrollViewRef, scrollYRef, viewHeightRef } = useEditorScrollView();
  const inputRef = useRef<NativeTextInput>(null);
  const ignoreNextChangeRef = useRef(false);
  const prevIsFocusedRef = useRef(false);
  const selectionRange = useEditorBlockSelection(index);
  const isWeb = Platform.OS === "web";
  const getFocusedBlockIndex = useEditorState(
    (state) => state.getFocusedBlockIndex,
  );
  const handleVerticalArrow = useVerticalArrowNavigation(index, selectionRange);

  useLayoutEffect(() => {
    if (isFocused && !prevIsFocusedRef.current && inputRef.current) {
      // Only programmatically focus if the TextInput isn't already focused.
      // When the user clicks directly on the (opacity:0) TextInput, it gets
      // native focus with the cursor at the clicked character. Calling focus()
      // again here resets the cursor to the end in most browsers, overriding
      // the click position. Skip it; the native cursor position is correct.
      if (!inputRef.current.isFocused()) {
        inputRef.current.focus();
      }
      if (Platform.OS !== "web") {
        requestAnimationFrame(() => {
          const scrollView = scrollViewRef?.current;
          if (!inputRef.current || !scrollView) return;
          inputRef.current.measureLayout(
            // RN types lag behind runtime: cast needed for newer measureLayout API
            scrollView as unknown as NativeMethods,
            (_x: number, y: number, _w: number, h: number) => {
              const scrollY = scrollYRef.current;
              const viewHeight = viewHeightRef.current;
              if (y < scrollY) {
                scrollView.scrollTo({ y: Math.max(0, y - 20), animated: true });
              } else if (y + h > scrollY + viewHeight) {
                scrollView.scrollTo({
                  y: y + h - viewHeight + 20,
                  animated: true,
                });
              }
            },
            () => {},
          );
        });
      }
    }
    prevIsFocusedRef.current = isFocused;
  }, [isFocused, scrollViewRef, scrollYRef, viewHeightRef]);

  // Tracks whether the TextInput received native focus from a user click so
  // handlePressablePress can skip its own focusBlock call (which would set the
  // cursor to content.length, overriding the clicked position).
  const textInputNativelyFocusedRef = useRef(false);

  // Called when the TextInput itself receives focus (user clicked directly on it).
  // On web, reads the browser cursor position set during mousedown BEFORE
  // focusBlock can override it with content.length.
  const handleTextInputFocus = useCallback(() => {
    if (isFocused && !hasBlockSelection) return;
    clearStructuredSelection();
    if (Platform.OS === "web") {
      const el = document.activeElement as HTMLTextAreaElement | null;
      const offset = el?.selectionStart ?? block.content.length;
      textInputNativelyFocusedRef.current = true;
      focusBlockAt(index, offset);
    } else {
      focusBlock(index);
    }
  }, [
    block.content.length,
    clearStructuredSelection,
    focusBlock,
    focusBlockAt,
    hasBlockSelection,
    index,
    isFocused,
  ]);

  // Called when the Pressable is tapped (e.g. empty space in the block). On web
  // the click also triggers handleTextInputFocus first (via bubbling), so we
  // skip this call when that already ran to avoid resetting cursor to end.
  const handleFocus = useCallback(() => {
    if (isFocused && !hasBlockSelection) return;
    if (textInputNativelyFocusedRef.current) {
      textInputNativelyFocusedRef.current = false;
      return;
    }
    clearStructuredSelection();
    focusBlock(index);
  }, [
    clearStructuredSelection,
    focusBlock,
    hasBlockSelection,
    index,
    isFocused,
  ]);

  // Web: document selectionchange fires on every cursor placement (including
  // plain clicks), whereas the TextInput onSelectionChange prop uses the
  // textarea `select` event which only fires on text selection. This gives
  // reliable cursor tracking for InlineMarkdown's custom cursor overlay.
  useEffect(() => {
    if (!isWeb || !isFocused) return;
    const handleDocSelectionChange = () => {
      const el = document.activeElement as HTMLTextAreaElement | null;
      if (el?.selectionStart != null) {
        onSelectionChange(
          index,
          el.selectionStart,
          el.selectionEnd ?? el.selectionStart,
        );
      }
    };
    document.addEventListener("selectionchange", handleDocSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleDocSelectionChange);
  }, [isWeb, isFocused, index, onSelectionChange]);

  const handleBlur = useCallback(() => {
    onBlockExit?.(index);
    const currentFocus = getFocusedBlockIndex();
    if (currentFocus === index) {
      blurBlock();
    }
  }, [blurBlock, getFocusedBlockIndex, index, onBlockExit]);

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start, end } = e.nativeEvent.selection;
      onSelectionChange(index, start, end);
    },
    [index, onSelectionChange],
  );

  const handleWikiLinkPress = useCallback(
    async (title: string, event: GestureResponderEvent) => {
      const wikiEvent = event as GestureResponderEvent &
        WikiLinkActivationEvent;

      if (!shouldOpenWikiLink(Platform.OS, wikiEvent)) {
        handleFocus();
        return;
      }

      stopWikiLinkActivation(wikiEvent);
      await onOpenWikiLink(title);
    },
    [handleFocus, onOpenWikiLink],
  );
  const { showActions } = useWikiLinkContext();
  const handleWikiLinkLongPress = useCallback(
    (title: string, event: GestureResponderEvent) => {
      if (Platform.OS !== "web") {
        showActions(title, event);
      }
    },
    [showActions],
  );
  const wikiLinks = useWikiLinkContext();
  const slashCommands = useSlashCommandContext();
  const handleContentChange = useCallback(
    (newText: string) => {
      // When we handle Enter to split the block, React Native's TextInput will still
      // emit an onChangeText with a newline. We want to ignore that one change,
      // because the actual split is handled via EditorState.splitBlock.
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false;
        return;
      }

      onContentChange(index, newText);
      if (isFocused && inputRef.current) {
        const caret = newText.length;
        const wikiLinkStart = findWikiLinkTriggerStart(newText, caret);
        const slashCommandStart = findSlashCommandTriggerStart(newText, caret);
        if (wikiLinkStart !== null) {
          const query = newText.slice(wikiLinkStart + 2, caret);
          slashCommands.handleCancel();
          wikiLinks.handleTriggerStart(index, wikiLinkStart, query);
        } else if (slashCommandStart !== null) {
          const query = newText.slice(slashCommandStart + 1, caret);
          wikiLinks.handleCancel();
          slashCommands.handleTriggerStart(index, slashCommandStart, query);
        } else {
          wikiLinks.handleCancel();
          slashCommands.handleCancel();
        }
      }
    },
    [
      index,
      onContentChange,
      isFocused,
      wikiLinks.handleTriggerStart,
      wikiLinks.handleCancel,
      slashCommands.handleTriggerStart,
      slashCommands.handleCancel,
    ],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;

      if (handleVerticalArrow(key)) {
        return;
      }

      // Match list-block behavior for normal typing: only intercept space
      // when we explicitly handle a markdown trigger at the block end.
      if (
        key === " " &&
        block.type === BlockType.paragraph &&
        selectionRange &&
        selectionRange.start === selectionRange.end
      ) {
        const handled = onSpace(index, selectionRange.end);
        if (handled) {
          return;
        }
      }
      const isShiftModified = Boolean(
        (
          e.nativeEvent as TextInputKeyPressEventData & {
            shiftKey?: boolean;
          }
        ).shiftKey,
      );

      // Handle Enter key - split non-code blocks at the current cursor position
      if (
        key === "Enter" &&
        !isShiftModified &&
        selectionRange &&
        selectionRange.start === selectionRange.end
      ) {
        if (block.type !== BlockType.codeBlock) {
          if (Platform.OS === "web") {
            // On web, React re-renders and moves focus to the new block before
            // the browser fires its default action (inserting \n). Preventing
            // the default stops the \n from landing in the new block's textarea.
            e.preventDefault();
          } else {
            // On native, focus stays on the current textarea when the default
            // action fires, so we can safely ignore that one onChangeText.
            ignoreNextChangeRef.current = true;
          }
          onEnter(index, selectionRange.end);
        }
        return;
      }

      // Handle backspace at the start (position 0)
      if (
        key === "Backspace" &&
        selectionRange?.start === 0 &&
        selectionRange?.end === 0
      ) {
        if (Platform.OS === "web") {
          e.preventDefault();
        } else {
          ignoreNextChangeRef.current = true;
        }

        // Paragraph blocks: delegate to editor-level handler (empty = delete, non-empty = merge or focus previous)
        if (block.type === BlockType.paragraph) {
          onBackspaceAtStart(index);
          return;
        }

        // Non-paragraph, non-code blocks (e.g., headings): convert to paragraph
        if (block.type !== BlockType.codeBlock) {
          onBackspaceAtStart(index);
        }
        return;
      }
    },
    [
      block.type,
      handleVerticalArrow,
      index,
      onBackspaceAtStart,
      onEnter,
      onSpace,
      selectionRange,
    ],
  );

  const theme = useExtendedTheme();
  const styles = useStyles(createStyles);

  // Compute text style based on block type
  const textStyle: TextStyle = useMemo(() => {
    switch (block.type) {
      case BlockType.heading1:
        return styles.heading1Style;
      case BlockType.heading2:
        return styles.heading2Style;
      case BlockType.heading3:
        return styles.heading3Style;
      default:
        return styles.bodyStyle;
    }
  }, [block.type, styles]);
  const selectionProp =
    isFocused && selectionRange
      ? (() => {
          const len = block.content.length;
          return {
            start: Math.min(selectionRange.start, len),
            end: Math.min(selectionRange.end, len),
          };
        })()
      : undefined;
  const [numberOfLines, setNumberOfLines] = useState(1);
  const textInputStyle = [
    styles.input,
    textStyle,
    { opacity: isFocused ? 1 : 0, position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 },
  ];

  const textInputProps = {
    ref: inputRef,
    style: textInputStyle,
    value: block.content, // I get an error on mobile
    ...(selectionProp !== undefined && { selection: selectionProp }),
    onChangeText: handleContentChange,
    onFocus: handleTextInputFocus,
    onBlur: handleBlur,
    onKeyPress: handleKeyPress,
    onSelectionChange: handleSelectionChange,
    onContentSizeChange: (event) => {
      setNumberOfLines(
        event.nativeEvent.contentSize.height / textStyle.lineHeight!,
      );
    },
    numberOfLines,
    multiline: true,
    scrollEnabled: false,
    autoGrow: true,
    autoCapitalize: "none" as const,
    autoCorrect: false,
    spellCheck: false,
    autoComplete: "off" as const,
    placeholderTextColor: theme.custom.editor.placeholder,
  };

  const applyListStyles = isListItem(block.type);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handleFocus}
    >
      <View style={[styles.row]}>
        {applyListStyles && (
          <ListMarker
            type={
              block.type as
                | BlockType.bulletList
                | BlockType.numberedList
                | BlockType.checkboxList
            }
            listLevel={getListLevel(block)}
            listItemNumber={listItemNumber}
            checked={
              block.type === BlockType.checkboxList
                ? !!block.attributes?.checked
                : undefined
            }
            onToggle={
              block.type === BlockType.checkboxList
                ? () => onCheckboxToggle(index)
                : undefined
            }
          />
        )}
        <View
          style={[
            { flex: 1 },
            applyListStyles && { marginLeft: (getListLevel(block) + 1) * 16 },
          ]}
          pointerEvents="box-none"
        >
          <TextInput
            {...textInputProps}
            textAlignVertical={applyListStyles ? undefined : "top"}
          />
          <View
            style={[styles.overlay, isFocused ? { opacity: 0 } : null]}
            pointerEvents="box-none"
          >
            <InlineMarkdown
              text={block.content}
              style={textStyle}
              onWikiLinkPress={handleWikiLinkPress}
              onWikiLinkLongPress={handleWikiLinkLongPress}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      paddingVertical: 2,
      paddingHorizontal: 14,
      position: "relative",
    },
    pressed: {
      opacity: 0.8,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      position: "relative",
    },
    overlay: {
      alignItems: "flex-start",
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      ...webMultilineTextInputReset,
    },
    heading1Style: theme.typography.heading1,
    heading2Style: theme.typography.heading2,
    heading3Style: theme.typography.heading3,
    bodyStyle: theme.typography.body,
  });
}
