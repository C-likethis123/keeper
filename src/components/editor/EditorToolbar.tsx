import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { IconButton } from "@/components/shared/IconButton";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import { useEditorState } from "@/stores/editorStore";
import React from "react";
import { StyleSheet, View } from "react-native";
import { BlockType, getListLevel, isListItem } from "./core/BlockNode";

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
  },
});

interface EditorToolbarProps {
  onAttachDocument?: () => void;
  hasAttachment?: boolean;
  isAttachmentVisible?: boolean;
  onShowAttachment?: () => void;
  onHideAttachment?: () => void;
  onRemoveAttachment?: () => void;
  showRelatedNotes?: boolean;
  onToggleRelatedNotes?: () => void;
}

export function EditorToolbar({
  onAttachDocument,
  hasAttachment = false,
  isAttachmentVisible = false,
  onShowAttachment,
  onHideAttachment,
  onRemoveAttachment,
  showRelatedNotes = false,
  onToggleRelatedNotes,
}: EditorToolbarProps) {
  const canUndo = useEditorState((s) => s.getCanUndo());
  const canRedo = useEditorState((s) => s.getCanRedo());
  const block = useEditorState((s) => s.getFocusedBlock());
  const blockType = block?.type ?? null;
  const listLevel = block ? getListLevel(block) : 0;
  const commandContext = useEditorCommandContext({
    isEditorActive: true,
    isWikiLinkModalOpen: false,
    dismissOverlays: () => false,
  });
  const {
    handleOutdent,
    handleIndent,
    handleConvertToCheckbox,
    handleInsertImage,
    handleInsertCollapsible,
  } = useToolbarActions();

  const isListBlock = isListItem(blockType);

  const canOutdent = isListBlock;
  const canIndent = isListBlock && listLevel >= 0;
  const canConvertToCheckbox =
    blockType != null && blockType !== BlockType.checkboxList;
  const canAttachDocument = onAttachDocument != null;
  const canShowAttachment = onShowAttachment != null;
  const canHideAttachment = onHideAttachment != null;
  const canRemoveAttachment = onRemoveAttachment != null;

  return (
    <View style={styles.toolbar}>
      <IconButton
        name="undo"
        onPress={() => executeEditorCommand("undo", commandContext)}
        disabled={!canUndo}
      />
      <IconButton
        name="repeat"
        onPress={() => executeEditorCommand("redo", commandContext)}
        disabled={!canRedo}
      />
      <IconButton name="indent" onPress={handleIndent} disabled={!canIndent} />
      <IconButton
        name="dedent"
        onPress={handleOutdent}
        disabled={!canOutdent}
      />
      <IconButton
        name="square-o"
        onPress={handleConvertToCheckbox}
        disabled={!canConvertToCheckbox}
      />
      <IconButton name="angle-down" onPress={handleInsertCollapsible} />
      <IconButton name="image" onPress={handleInsertImage} />
      {/* Attach PDF/ePub */}
      {hasAttachment ? (
        <>
          <IconButton
            name={isAttachmentVisible ? "times-circle" : "eye"}
            onPress={
              isAttachmentVisible
                ? (onHideAttachment ?? (() => {}))
                : (onShowAttachment ?? (() => {}))
            }
            disabled={
              isAttachmentVisible ? !canHideAttachment : !canShowAttachment
            }
            label={isAttachmentVisible ? "Hide attachment" : "View attachment"}
          />
          <IconButton
            name="trash"
            onPress={onRemoveAttachment ?? (() => {})}
            disabled={!canRemoveAttachment}
            label="Remove attachment"
          />
        </>
      ) : (
        <IconButton
          name="paperclip"
          onPress={onAttachDocument ?? (() => {})}
          disabled={!canAttachDocument}
          label="Attach PDF or ePub"
        />
      )}
      {/* Related Notes toggle */}
      {onToggleRelatedNotes && (
        <IconButton
          name={showRelatedNotes ? "unlink" : "link"}
          onPress={onToggleRelatedNotes}
          label={showRelatedNotes ? "Hide related notes" : "Show related notes"}
        />
      )}
    </View>
  );
}
