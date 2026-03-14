import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import { useEditorState } from "@/stores/editorStore";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { BlockType, getListLevel, isListItem } from "./core/BlockNode";

export function EditorToolbar({ disabled = false }: { disabled?: boolean }) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
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

	const canOutdent = !disabled && isListBlock;
	const canIndent = !disabled && isListBlock && listLevel >= 0 && listLevel < 10;
	const canConvertToCheckbox =
		!disabled && blockType != null && blockType !== BlockType.checkboxList;
	const canUndo = !disabled && getCanUndo();
	const canRedo = !disabled && getCanRedo();

	return (
		<View style={styles.toolbar}>
			<TouchableOpacity
				style={[styles.button]}
				onPress={() => {
					executeEditorCommand("undo", commandContext);
				}}
				disabled={!canUndo}
				activeOpacity={0.7}
			>
				<MaterialIcons
					name="undo"
					size={24}
					color={canUndo ? theme.colors.text : theme.colors.textDisabled}
				/>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.button]}
				onPress={() => {
					executeEditorCommand("redo", commandContext);
				}}
				disabled={!canRedo}
				activeOpacity={0.7}
			>
				<MaterialIcons
					name="redo"
					size={24}
					color={canRedo ? theme.colors.text : theme.colors.textDisabled}
				/>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.button]}
				onPress={handleIndent}
				activeOpacity={0.7}
				disabled={!canIndent}
			>
				<MaterialIcons
					name="format-indent-increase"
					size={24}
					color={canIndent ? theme.colors.text : theme.colors.textDisabled}
				/>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.button]}
				onPress={handleOutdent}
				activeOpacity={0.7}
				disabled={!canOutdent}
			>
				<MaterialIcons
					name="format-indent-decrease"
					size={24}
					color={canOutdent ? theme.colors.text : theme.colors.textDisabled}
				/>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.button]}
				onPress={handleConvertToCheckbox}
				activeOpacity={0.7}
				disabled={!canConvertToCheckbox}
			>
				<MaterialIcons
					name="check-box-outline-blank"
					size={24}
					color={
						canConvertToCheckbox ? theme.colors.text : theme.colors.textDisabled
					}
				/>
			</TouchableOpacity>
			{Platform.OS !== "web" ? (
				<TouchableOpacity
					style={styles.button}
					onPress={handleInsertImage}
					activeOpacity={0.7}
					disabled={disabled}
				>
					<MaterialIcons
						name="add-photo-alternate"
						size={24}
						color={disabled ? theme.colors.textDisabled : theme.colors.text}
					/>
				</TouchableOpacity>
			) : (
				<Text>TODO: Insert Image</Text>
			)}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		toolbar: {
			flexDirection: "row",
			borderBottomWidth: 1,
			paddingVertical: 8,
			paddingHorizontal: 16,
			justifyContent: "flex-start",
			alignItems: "center",
			gap: 12,
		},
		button: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: theme.colors.background,
			justifyContent: "center",
			alignItems: "center",
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
	});
}
