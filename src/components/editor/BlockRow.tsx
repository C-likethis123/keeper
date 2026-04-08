import {
  type BlockConfig,
  blockRegistry,
} from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";
import { getListItemNumber } from "@/components/editor/core/Document";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import React, { useState } from "react";
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface BlockRowHandlers {
  onContentChange: (index: number, content: string) => void;
  onBlockTypeChange?: (
    index: number,
    newType: BlockType,
    language?: string,
  ) => void;
  onAttributesChange?: (
    index: number,
    newAttributes: Record<string, unknown>,
  ) => void;
  onBackspaceAtStart: (index: number) => void;
  onSpace: (index: number, cursorOffset: number) => boolean;
  onEnter: (index: number, cursorOffset: number) => void;
  onBlockExit?: (index: number) => void;
  onSelectionChange: (index: number, start: number, end: number) => void;
  onDelete: (index: number) => void;
  onCheckboxToggle: (index: number) => void;
  onOpenWikiLink: (title: string) => void;
  onSelectBlock: (index: number) => void;
  onSelectBlockRange: (index: number) => void;
  onClearStructuredSelection: () => void;
}

interface BlockRowProps {
  index: number;
  handlers: BlockRowHandlers;
}

const DRAG_HANDLE_DOT_KEYS = [
  "top-left",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-right",
] as const;

export const BlockRow = React.memo(function BlockRow({
  index,
  handlers,
}: BlockRowProps) {
  const theme = useExtendedTheme();
  const styles = useStyles(makeStyles);
  const block = useEditorBlock(index);
  const isFocused = useEditorState(
    (s) => (s.selection?.focus.blockIndex ?? null) === index,
  );
  const hasBlockSelection = useEditorState((s) => {
    const selection = s.blockSelection;
    return (
      selection != null && index >= selection.start && index <= selection.end
    );
  });
  const isGapSelected = useEditorState((s) => s.gapSelection?.index === index);
  const listItemNumber = useEditorState((s) => {
    const b = s.document.blocks[index];
    return b?.type === BlockType.numberedList
      ? getListItemNumber(s.document, index)
      : undefined;
  });

  const [isRowHovered, setIsRowHovered] = useState(false);

  if (!block) {
    return null;
  }

  const config: BlockConfig = {
    block,
    index,
    isFocused,
    hasBlockSelection,
    isGapSelected,
    onContentChange: handlers.onContentChange,
    onBlockTypeChange: handlers.onBlockTypeChange,
    onAttributesChange: handlers.onAttributesChange,
    onBackspaceAtStart: handlers.onBackspaceAtStart,
    onSpace: handlers.onSpace,
    onEnter: handlers.onEnter,
    onBlockExit: handlers.onBlockExit,
    onSelectionChange: handlers.onSelectionChange,
    onDelete: handlers.onDelete,
    listItemNumber,
    onCheckboxToggle: handlers.onCheckboxToggle,
    onOpenWikiLink: handlers.onOpenWikiLink,
    clearStructuredSelection: handlers.onClearStructuredSelection,
  };

  const handleGutterPress = (event: GestureResponderEvent) => {
    const nativeEvent =
      event.nativeEvent as GestureResponderEvent["nativeEvent"] & {
        shiftKey?: boolean;
      };
    if (nativeEvent.shiftKey) {
      handlers.onSelectBlockRange(index);
      return;
    }
    handlers.onSelectBlock(index);
  };

  const showRowChrome =
    isRowHovered || hasBlockSelection || isFocused || isGapSelected;

  return (
    <View
      style={styles.blockWrapper}
      collapsable={false}
      onPointerEnter={() => setIsRowHovered(true)}
      onPointerLeave={() => setIsRowHovered(false)}
    >
      <View
        style={[
          styles.rowShell,
          hasBlockSelection && styles.rowShellSelected,
          {
            position:
              Platform.OS === "web" && config.block.type === BlockType.video
                ? // biome-ignore lint/suspicious/noExplicitAny: sticky is web-only
                  ("sticky" as any)
                : "relative",
            zIndex: config.block.type === BlockType.video ? 20 : 1,
            top: config.block.type === BlockType.video ? 0 : undefined,
          },
        ]}
      >
        <View style={styles.leftRail}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select block ${index + 1}`}
            testID={`block-gutter-${index}`}
            style={[
              styles.chromeButton,
              showRowChrome && styles.chromeButtonVisible,
              styles.dragHandle,
              hasBlockSelection && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={handleGutterPress}
          >
            <View style={styles.dragHandleDots}>
              {DRAG_HANDLE_DOT_KEYS.map((dotKey) => (
                <View
                  key={dotKey}
                  style={[
                    styles.dragHandleDot,
                    hasBlockSelection && styles.dragHandleDotSelected,
                  ]}
                />
              ))}
            </View>
          </Pressable>
        </View>
        <View style={styles.blockContent}>{blockRegistry.build(config)}</View>
      </View>
    </View>
  );
});

function makeStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    blockWrapper: {
      width: "100%",
    },
    gapPressable: {
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    rowShell: {
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    rowShellHovered: {
      backgroundColor: theme.custom.editor.blockFocused,
    },
    rowShellSelected: {
      backgroundColor: theme.custom.editor.blockFocused,
      borderColor: theme.colors.primary,
    },
    leftRail: {
      width: 40,
      paddingLeft: 6,
      paddingRight: 4,
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    chromeButton: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0,
    },
    chromeButtonVisible: {
      opacity: 1,
      borderColor: theme.custom.editor.blockBorder,
      backgroundColor: theme.colors.background,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    chromeButtonText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 18,
    },
    dragHandle: {
      cursor: Platform.OS === "web" ? ("grab" as const) : undefined,
    },
    dragHandleDots: {
      width: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 2,
    },
    dragHandleDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted,
    },
    dragHandleDotSelected: {
      backgroundColor: theme.colors.primaryContrast,
    },
    blockContent: {
      flex: 1,
      minWidth: 0,
    },
  });
}
