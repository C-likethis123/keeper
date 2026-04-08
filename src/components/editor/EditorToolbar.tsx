import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { IconButton } from "@/components/shared/IconButton";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import { useEditorState } from "@/stores/editorStore";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
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
	onAttachDocument: () => void;
	hasAttachment?: boolean;
	onRemoveAttachment: () => void;
}

export function EditorToolbar({
	onAttachDocument,
	hasAttachment = false,
	onRemoveAttachment,
}: EditorToolbarProps) {
	const getCanUndo = useEditorState((s) => s.getCanUndo);
	const getCanRedo = useEditorState((s) => s.getCanRedo);
	const getFocusedBlock = useEditorState((s) => s.getFocusedBlock);
	const block = getFocusedBlock();
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
	const canIndent = isListBlock && listLevel >= 0 && listLevel < 10;
	const canConvertToCheckbox =
		blockType != null && blockType !== BlockType.checkboxList;
	const canUndo = getCanUndo();
	const canRedo = getCanRedo();

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
			{Platform.OS !== "web" ? (
				<IconButton name="image" onPress={handleInsertImage} />
			) : (
				<Text>TODO: Insert Image</Text>
			)}
			{/* Attach PDF/ePub */}
			{hasAttachment ? (
				<IconButton
					name="times-circle"
					onPress={onRemoveAttachment ?? (() => {})}
					label="Remove attachment"
				/>
			) : (
				<IconButton
					name="paperclip"
					onPress={onAttachDocument}
					label="Attach PDF or ePub"
				/>
			)}
		</View>
	);
}
