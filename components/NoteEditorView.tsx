import { SaveIndicator } from "@/components/SaveIndicator";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { HybridEditor } from "@/components/editor/HybridEditor";
import type { EditorState } from "@/components/editor/core/EditorState";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Platform,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

// TODO: assert that the note is present
export default function NoteEditorView(props: { note: Note }) {
	const router = useRouter();
	const theme = useExtendedTheme();
	const [note, setNote] = useState<Note>(props.note);

	const togglePin = useCallback(async () => {
		const next = !note?.isPinned;
		const newNote = { ...note, isPinned: next };
		await NoteService.saveNote(newNote);
		setNote(newNote);
	}, [note]);

	const { status } = useAutoSave(note);

	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	// Reset editor when switching to a different note; omit note.content so we don't run on every keystroke
	// biome-ignore lint/correctness/useExhaustiveDependencies: note.id only — loading note.content on id change
	useEffect(() => {
		loadMarkdown(note.content);
	}, [note.id, loadMarkdown]);

	const handleContentChange = useCallback(async (markdown: string) => {
		setNote((prev) => {
			const next = { ...prev, content: markdown };
			return next;
		});
	}, []);

	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.screen}>
			<Stack.Screen
				options={{
					title: "Editor",
					headerLeft: () => (
						<TouchableOpacity
							onPress={async () => {
								const title = note.title;
								const content = note.content;
								await NoteService.saveNote({
									id: note.id,
									title,
									content,
									isPinned: note?.isPinned ?? false,
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
									await NoteService.deleteNote(note.id as string);
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
				<TextInput
					style={styles.titleInput}
					value={note.title}
					onChangeText={(text) => {
						setNote((prev) => ({ ...prev, title: text }));
					}}
					placeholder="Title"
					placeholderTextColor={theme.custom.editor.placeholder}
				/>

				<EditorToolbar />
				<HybridEditor
					initialContent={note.content}
					onChanged={handleContentChange}
				/>
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
