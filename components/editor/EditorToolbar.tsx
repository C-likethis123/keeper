import { useEditorState } from "@/contexts/EditorContext";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { BlockType } from "./core/BlockNode";

export function EditorToolbar() {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const editorState = useEditorState();
	const {
		type: blockType,
		listLevel,
	} = editorState.getFocusedBlock() ?? {
		type: null,
		listLevel: 0,
	};
	const { handleOutdent, handleIndent, handleInsertImage } = useToolbarActions();

	const isListBlock =
		blockType === BlockType.bulletList || blockType === BlockType.numberedList;

	const canOutdent = isListBlock;
	const canIndent = isListBlock && listLevel >= 0 && listLevel < 10;
	const canUndo = editorState.getCanUndo();
	const canRedo = editorState.getCanRedo();

	return (
		<View style={styles.toolbar}>
			<TouchableOpacity
				style={[styles.button, !canUndo && styles.buttonHidden]}
				onPress={editorState.undo}
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
				style={[styles.button, !canRedo && styles.buttonHidden]}
				onPress={editorState.redo}
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
				style={[styles.button, !canIndent && styles.buttonHidden]}
				onPress={handleIndent}
				activeOpacity={0.7}
			>
				<MaterialIcons
					name="format-indent-increase"
					size={24}
					color={theme.colors.text}
				/>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.button, !canOutdent && styles.buttonHidden]}
				onPress={handleOutdent}
				activeOpacity={0.7}
			>
				<MaterialIcons
					name="format-indent-decrease"
					size={24}
					color={theme.colors.text}
				/>
			</TouchableOpacity>
			{Platform.OS !== "web" ? (
				<TouchableOpacity
					style={styles.button}
					onPress={handleInsertImage}
					activeOpacity={0.7}
				>
					<MaterialIcons
						name="add-photo-alternate"
						size={24}
						color={theme.colors.text}
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
		buttonHidden: {
			display: "none",
		},
	});
}
