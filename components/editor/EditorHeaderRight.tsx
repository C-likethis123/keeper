import { useEditorState } from "@/contexts/EditorContext";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import type { Note } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import React, { useEffect } from "react";
import { TouchableOpacity } from "react-native";

interface EditorHeaderRightProps {
	note: Note | null;
	onTogglePin: () => void;
	onDelete: () => void;
}

export function EditorHeaderRight({
	note,
	onTogglePin,
	onDelete,
}: EditorHeaderRightProps) {
	const theme = useExtendedTheme();
	const navigation = useNavigation();
	const { getCanUndo, getCanRedo, undo, redo } = useEditorState();
	const canUndo = getCanUndo();
	const canRedo = getCanRedo();

	useEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<>
					<TouchableOpacity
						onPress={undo}
						disabled={!canUndo}
						style={{ marginRight: 8 }}
					>
						<MaterialIcons
							name="undo"
							size={24}
							color={canUndo ? theme.colors.text : theme.colors.textMuted}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={redo}
						disabled={!canRedo}
						style={{ marginRight: 8 }}
					>
						<MaterialIcons
							name="redo"
							size={24}
							color={canRedo ? theme.colors.text : theme.colors.textMuted}
						/>
					</TouchableOpacity>
					<TouchableOpacity onPress={onTogglePin} style={{ marginRight: 8 }}>
						<MaterialIcons
							name="push-pin"
							size={24}
							color={
								note?.isPinned ? theme.colors.primary : theme.colors.textMuted
							}
						/>
					</TouchableOpacity>
					<TouchableOpacity onPress={onDelete} style={{ marginRight: 8 }}>
						<MaterialIcons
							name="delete"
							size={24}
							color={theme.colors.textMuted}
						/>
					</TouchableOpacity>
				</>
			),
		});
	}, [
		navigation,
		theme,
		note?.isPinned,
		canUndo,
		canRedo,
		undo,
		redo,
		onTogglePin,
		onDelete,
	]);

	return null;
}
