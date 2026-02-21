import Loader from "@/components/Loader";
import { SaveIndicator } from "@/components/SaveIndicator";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { HybridEditor } from "@/components/editor/HybridEditor";
import type { BlockType } from "@/components/editor/core/BlockNode";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import { EditorProvider } from "@/contexts/EditorContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useLoadNote } from "@/hooks/useLoadNote";
import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useNoteStore } from "@/stores/notes/noteStore";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
	Platform,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View
} from "react-native";

export default function NoteEditorScreen() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const { filePath } = params;
	const theme = useExtendedTheme();

	const { loadNote, deleteNote } = useNoteStore();
	const { setPinned } = useNotesMetaStore();
	const [focusedBlockInfo, setFocusedBlockInfo] = useState<{
		blockType: BlockType | null;
		blockIndex: number | null;
		listLevel: number;
	}>({
		blockType: null,
		blockIndex: null,
		listLevel: 0,
	});

	// Load existing note if editing
	const { isLoading, error, note, setNote } = useLoadNote(filePath as string);

	const togglePin = async () => {
		if (!note) return;
		const path = note.filePath;
		if (!path) return;
		const next = !note.isPinned;
		setNote((prev) => (prev ? { ...prev, isPinned: next } : null));
		await setPinned(path, next);
	};

	const effectiveFilePath =
		note?.filePath ?? (filePath as string) ?? "";
	const isNewNote = !(filePath as string)?.trim();

	const { status, saveNow } = useAutoSave({
		filePath: effectiveFilePath,
		title: note?.title || "",
		content: note?.content || "",
		isPinned: note?.isPinned || false,
		onSaved: isNewNote
			? (saved) => setNote(saved)
			: undefined,
	});

	const handleContentChange = (markdown: string) => {
		setNote((prev) => {
			if (!prev) {
				return {
					title: "",
					content: markdown,
					filePath: "",
					lastUpdated: Date.now(),
					isPinned: false,
				};
			}
			return { ...prev, content: markdown };
		});
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
								await saveNow();
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
									if (note?.filePath) {
										await deleteNote(note.filePath);
										router.back();
									}
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
							value={note?.title || ""}
							onChangeText={(text) =>
								setNote((prev) => {
									if (!prev) {
										return {
											title: text,
											content: "",
											filePath: "",
											lastUpdated: Date.now(),
											isPinned: false,
										};
									}
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
								initialContent={note?.content || ""}
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
