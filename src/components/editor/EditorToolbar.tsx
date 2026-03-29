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

export function EditorToolbar() {
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
				name="redo"
				onPress={() => executeEditorCommand("redo", commandContext)}
				disabled={!canRedo}
			/>
			<IconButton
				name="format-indent-increase"
				onPress={handleIndent}
				disabled={!canIndent}
			/>
			<IconButton
				name="format-indent-decrease"
				onPress={handleOutdent}
				disabled={!canOutdent}
			/>
			<IconButton
				name="check-box-outline-blank"
				onPress={handleConvertToCheckbox}
				disabled={!canConvertToCheckbox}
			/>
			{Platform.OS !== "web" ? (
				<IconButton name="add-photo-alternate" onPress={handleInsertImage} />
			) : (
				<Text>TODO: Insert Image</Text>
			)}
		</View>
	);
}
