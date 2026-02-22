import Loader from "@/components/Loader";
import { SaveIndicator } from "@/components/SaveIndicator";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { HybridEditor } from "@/components/editor/HybridEditor";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import { EditorProvider } from "@/contexts/EditorContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useLoadNote } from "@/hooks/useLoadNote";
import type { Note } from "@/services/notes/types";
import { useNoteStore } from "@/stores/notes/noteStore";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
	Platform,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

export default function NoteEditorScreen() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const { id } = params;
	const theme = useExtendedTheme();

	const { deleteNote, saveNote } = useNoteStore();

	const { isLoading, error, note, setNote } = useLoadNote(id as string);

	const togglePin = async () => {
		const next = !note.isPinned;
		setNote((prev: Note) => ({ ...prev, isPinned: next }));
	};

	const { status } = useAutoSave({
		id: id as string,
		title: note.title,
		content: note.content,
		isPinned: note.isPinned ?? false,
	});

	const handleContentChange = (markdown: string) => {
		setNote((prev: Note) => ({ ...prev, content: markdown }));
	};

	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.screen}>
			<Stack.Screen
				options={{
					title: "Editor",
					headerLeft: () => (
						<TouchableOpacity
							onPress={async () => {
								await saveNote({
									id: note.id,
									title: note.title,
									content: note.content,
									isPinned: note.isPinned,
									lastUpdated: Date.now(),
								});
								router.back();
							}}
							style={{ marginLeft: 8, marginRight: 8 }}
						>
							<MaterialIcons
								name="arrow-back"
								size={24}
								color={theme.colors.text}
							/>
						</TouchableOpacity>
					),
					headerRight: () => (
						<>
							<TouchableOpacity onPress={togglePin} style={{ marginRight: 8 }}>
								<MaterialIcons
									name="push-pin"
									size={24}
									color={
										note?.isPinned
											? theme.colors.primary
											: theme.colors.textMuted
									}
								/>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={async () => {
									await deleteNote(note.id);
									router.back();
								}}
								style={{ marginRight: 8 }}
							>
								<MaterialIcons
									name="delete"
									size={24}
									color={theme.colors.textMuted}
								/>
							</TouchableOpacity>
						</>
					),
					headerTitle: () =>
						Platform.OS === "web" ? null : <SaveIndicator status={status} />,
				}}
			/>

			<View style={styles.content}>
				{isLoading ? (
					<Loader />
				) : (
					<>
						<TextInput
							style={styles.titleInput}
							value={note.title}
							onChangeText={(text) =>
								setNote((prev) => {
									return { ...prev, title: text };
								})
							}
							placeholder="Title"
							placeholderTextColor={theme.custom.editor.placeholder}
							autoFocus={!note}
						/>

						<EditorProvider>
							<EditorToolbar />
							<HybridEditor
								initialContent={note.content}
								onChanged={handleContentChange}
							/>
						</EditorProvider>
					</>
				)}
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		screen: {
			flex: 1,
		},
		content: {
			flex: 1,
			padding: 16,
			paddingBottom: 16 + TOOLBAR_HEIGHT,
			backgroundColor: theme.colors.background,
		},
		toolbarWrapper: {
			position: "absolute",
			left: 0,
			right: 0,
			backgroundColor: theme.colors.background,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		titleInput: {
			fontSize: 20,
			fontWeight: "600",
			marginBottom: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			paddingVertical: 4,
			color: theme.colors.text,
		},
	});
}
