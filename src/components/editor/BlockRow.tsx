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
  onSelectGap: (index: number) => void;
  onClearStructuredSelection: () => void;
}

interface BlockRowProps {
  index: number;
  handlers: BlockRowHandlers;
  isLastBlock: boolean;
}

export const BlockRow = React.memo(function BlockRow({
  index,
  handlers,
  isLastBlock: _isLastBlock,
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

  return (
    <View
      style={styles.blockWrapper}
      collapsable={false}
      onPointerEnter={() => setIsRowHovered(true)}
      onPointerLeave={() => setIsRowHovered(false)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select gap before block ${index + 1}`}
        testID={`block-gap-${index}`}
        style={styles.gapPressable}
        onPress={() => handlers.onSelectGap(index)}
      >
        <View
          style={[
            styles.gapIndicator,
            isGapSelected && { backgroundColor: theme.colors.primary },
          ]}
        />
      </Pressable>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select block ${index + 1}`}
          testID={`block-gutter-${index}`}
          style={[
            styles.gutter,
            (isRowHovered || hasBlockSelection) && styles.gutterVisible,
            hasBlockSelection && { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleGutterPress}
        />
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
    gapIndicator: {
      borderRadius: 999,
      height: 3,
      backgroundColor: theme.custom.editor.blockBorder,
    },
    rowShell: {
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "transparent",
    },
    rowShellSelected: {
      backgroundColor: theme.custom.editor.blockFocused,
      borderColor: theme.colors.primary,
    },
    gutter: {
      width: 10,
      marginLeft: 4,
      marginRight: 6,
      borderRadius: 999,
      backgroundColor: "transparent",
    },
    gutterVisible: {
      backgroundColor: theme.custom.editor.blockBorder,
    },
    blockContent: {
      flex: 1,
    },
  });
}
