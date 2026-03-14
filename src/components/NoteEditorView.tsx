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
import { useStorageStore } from "@/stores/storageStore";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { EditorScrollProvider } from "./editor/EditorScrollContext";

export default function NoteEditorView({ note }: { note: Note }) {
	const router = useRouter();
	const theme = useExtendedTheme();
	const id = note.id;
	const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
	const [title, setTitle] = useState<string>(note.title);
	const capabilities = useStorageStore((s) => s.capabilities);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	const getContent = useEditorState((s: EditorState) => s.getContent);

	const togglePin = useCallback(async () => {
		if (!capabilities.canWrite) {
			showToast(capabilities.reason ?? "Read-only mode");
			return;
		}
		const newNote = {
			content: getContent(),
			title,
			isPinned: !isPinned,
			lastUpdated: Date.now(),
			id,
		};
		await NoteService.saveNote(newNote);
		setIsPinned((prev) => !prev);
	}, [
		id,
		title,
		isPinned,
		capabilities.canWrite,
		capabilities.reason,
		showToast,
		getContent,
	]);

	const { status } = useAutoSave(note);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only load this when starting
	useEffect(() => {
		loadMarkdown(note.content);
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
								if (!capabilities.canWrite) {
									router.back();
									return;
								}
								await NoteService.saveNote({
									id,
									title,
									content: getContent(),
									isPinned: isPinned,
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
							<TouchableOpacity
								onPress={togglePin}
								style={{ marginRight: 8 }}
								disabled={!capabilities.canWrite}
							>
								<MaterialIcons
									name="push-pin"
									size={24}
									color={
										isPinned ? theme.colors.primary : theme.colors.textMuted
									}
								/>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={async () => {
									if (!capabilities.canWrite) {
										showToast(capabilities.reason ?? "Read-only mode");
										return;
									}
									await NoteService.deleteNote(id as string);
									router.back();
								}}
								style={{ marginRight: 8 }}
								disabled={!capabilities.canWrite}
							>
								<MaterialIcons
									name="delete"
									size={24}
									color={theme.colors.textMuted}
								/>
							</TouchableOpacity>
						</>
					),
					headerTitle: () => <SaveIndicator status={status} />,
				}}
			/>

			<View style={styles.content}>
				<TextInput
					style={styles.titleInput}
					value={title}
					onChangeText={capabilities.canWrite ? setTitle : undefined}
					editable={capabilities.canWrite}
					placeholder="Title"
					placeholderTextColor={theme.custom.editor.placeholder}
				/>

				<EditorToolbar disabled={!capabilities.canWrite} />
				<EditorScrollProvider>
					<HybridEditor />
				</EditorScrollProvider>
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
