import {
  ReactExtension,
  type EditorChildrenComponentProps,
} from "@lexical/react/ReactExtension";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import { useSignalValue } from "@lexical/react/useExtensionSignalValue";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { namedSignals } from "@lexical/extension";
import {
  configExtension,
  defineExtension,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  safeCast,
  UNDO_COMMAND,
} from "lexical";
import { FontAwesome } from "@expo/vector-icons";
import type React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

interface ToolbarExtensionConfig {
  getHasAttachment: () => boolean;
  getOnAttachDocument: () => (() => void) | undefined;
  getOnInsertImage: () => (() => void) | undefined;
  getOnRemoveAttachment: () => (() => void) | undefined;
  getOnShowVideoModal: () => (() => void) | undefined;
  getOnToggleArticle: () => (() => void) | undefined;
  getOnToggleRelatedNotes: () => (() => void) | undefined;
  getOnToggleActivePanel: () => (() => void) | undefined;
}

const styles = StyleSheet.create({
  toolbar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toolbarButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  toolbarButtonPressed: {
    opacity: 0.7,
  },
  toolbarIcon: {
    color: "#8e8e93",
  },
  toolbarIconDisabled: {
    color: "#4d4d4d",
  },
});

const noop = () => {};
type ToolbarIconName = React.ComponentProps<typeof FontAwesome>["name"];

function ToolbarIconButton({
  disabled = false,
  label,
  name,
  onPress,
}: {
  disabled?: boolean;
  label?: string;
  name: ToolbarIconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarButton,
        pressed && styles.toolbarButtonPressed,
      ]}
    >
      <FontAwesome
        name={name}
        size={20}
        style={[styles.toolbarIcon, disabled && styles.toolbarIconDisabled]}
      />
    </Pressable>
  );
}

function Toolbar() {
  const { output } = useExtensionDependency(ToolbarExtension);
  const [editor] = useLexicalComposerContext();
  const hasAttachment = useSignalValue(output.getHasAttachment)();
  const onAttachDocument = useSignalValue(output.getOnAttachDocument)();
  const onInsertImage = useSignalValue(output.getOnInsertImage)();
  const onRemoveAttachment = useSignalValue(output.getOnRemoveAttachment)();
  const onShowVideoModal = useSignalValue(output.getOnShowVideoModal)();
  const onToggleArticle = useSignalValue(output.getOnToggleArticle)();
  const onToggleRelatedNotes = useSignalValue(output.getOnToggleRelatedNotes)();
  const onToggleActivePanel = useSignalValue(output.getOnToggleActivePanel)();

  const handleUndo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
  const handleRedo = () => editor.dispatchCommand(REDO_COMMAND, undefined);
  const handleIndent = () =>
    editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
  const handleOutdent = () =>
    editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
  const handleInsertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: "3",
      includeHeaders: true,
      rows: "3",
    });
  };

  return (
    <View style={styles.toolbar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarContent}
      >
        <ToolbarIconButton name="undo" onPress={handleUndo} />
        <ToolbarIconButton name="repeat" onPress={handleRedo} />
        <ToolbarIconButton name="indent" onPress={handleIndent} />
        <ToolbarIconButton name="dedent" onPress={handleOutdent} />
        <ToolbarIconButton
          name="table"
          onPress={handleInsertTable}
          label="Insert table"
        />
        <ToolbarIconButton
          name="image"
          onPress={onInsertImage ?? noop}
          disabled={!onInsertImage}
          label="Insert image"
        />

        {hasAttachment ? (
          <ToolbarIconButton
            name="trash-o"
            onPress={onRemoveAttachment ?? noop}
            disabled={!onRemoveAttachment}
            label="Remove attachment"
          />
        ) : (
          <ToolbarIconButton
            name="paperclip"
            onPress={onAttachDocument ?? noop}
            disabled={!onAttachDocument}
            label="Attach PDF or ePub"
          />
        )}
        <ToolbarIconButton
          name="video-camera"
          onPress={onShowVideoModal ?? noop}
          disabled={!onShowVideoModal}
          label="Attach video"
        />
        <ToolbarIconButton
          name="newspaper-o"
          onPress={onToggleArticle ?? noop}
          disabled={!onToggleArticle}
          label="View article"
        />
        <ToolbarIconButton
          name="link"
          onPress={onToggleRelatedNotes ?? noop}
          disabled={!onToggleRelatedNotes}
          label="Show related notes"
        />
        <ToolbarIconButton
          name="exchange"
          onPress={onToggleActivePanel ?? noop}
          disabled={!onToggleActivePanel}
          label="Switch panel"
        />
      </ScrollView>
    </View>
  );
}

function ToolbarEditorChildren({
  contentEditable,
  children,
}: EditorChildrenComponentProps) {
  return (
    <>
      {contentEditable}
      <div className="keeper-editor-shell">
        <div className="keeper-toolbar-sticky">
          <Toolbar />
        </div>
        {children}
      </div>
    </>
  );
}

export const ToolbarExtension = defineExtension({
  config: safeCast<ToolbarExtensionConfig>({
    getHasAttachment: () => false,
    getOnAttachDocument: () => undefined,
    getOnInsertImage: () => undefined,
    getOnRemoveAttachment: () => undefined,
    getOnShowVideoModal: () => undefined,
    getOnToggleArticle: () => undefined,
    getOnToggleRelatedNotes: () => undefined,
    getOnToggleActivePanel: () => undefined,
  }),
  dependencies: [
    configExtension(ReactExtension, {
      EditorChildrenComponent: ToolbarEditorChildren,
    }),
  ],
  build(_editor, config) {
    return namedSignals(config);
  },
  name: "keeper/Toolbar",
});
