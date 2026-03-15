import { SaveIndicator } from "@/components/SaveIndicator";
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
import React, {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { EditorScrollProvider } from "./editor/EditorScrollContext";
import Loader from "./shared/Loader";

const LazyEditorToolbar = React.lazy(
	() => import("@/components/editor/EditorToolbar").then((module) => ({
		default: module.EditorToolbar,
	})),
);

const LazyHybridEditor = React.lazy(
	() => import("@/components/editor/HybridEditor").then((module) => ({
		default: module.HybridEditor,
	})),
);

const NOTE_TYPE_OPTIONS = [
	{ label: "Note", value: "note" },
	{ label: "Journal", value: "journal" },
	{ label: "Resource", value: "resource" },
	{ label: "Todo", value: "todo" },
] as const;

const TODO_STATUS_OPTIONS = [
	{ label: "Open", value: "open" },
	{ label: "Doing", value: "doing" },
	{ label: "Blocked", value: "blocked" },
	{ label: "Done", value: "done" },
] as const;

export default function NoteEditorView({ note }: { note: Note }) {
	const router = useRouter();
	const theme = useExtendedTheme();
	const id = note.id;
	const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
	const [title, setTitle] = useState<string>(note.title);
	const [noteType, setNoteType] = useState<Note["noteType"]>(note.noteType);
	const [todoStatus, setTodoStatus] = useState<Note["status"]>(
		note.noteType === "todo" ? (note.status ?? "open") : undefined,
	);
	const capabilities = useStorageStore((s) => s.capabilities);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	const getContent = useEditorState((s: EditorState) => s.getContent);

	const buildNotePayload = useCallback(
		(overrides?: Partial<Note>): Note => ({
			id,
			title,
			content: getContent(),
			isPinned,
			lastUpdated: Date.now(),
			noteType,
			status: noteType === "todo" ? (todoStatus ?? "open") : undefined,
			...overrides,
		}),
		[id, title, getContent, isPinned, noteType, todoStatus],
	);

	const togglePin = useCallback(async () => {
		if (!capabilities.canWrite) {
			showToast(capabilities.reason ?? "Read-only mode");
			return;
		}
		const newNote = buildNotePayload({ isPinned: !isPinned });
		await NoteService.saveNote(newNote);
		setIsPinned((prev) => !prev);
	}, [
		capabilities.canWrite,
		capabilities.reason,
		showToast,
		buildNotePayload,
		isPinned,
	]);

	const { status } = useAutoSave({
		...note,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? (todoStatus ?? "open") : undefined,
	});
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
								await NoteService.saveNote(buildNotePayload());
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
				<View style={styles.metadataSection}>
					<View style={styles.metadataGroup}>
						<Text style={styles.metadataLabel}>Type</Text>
						<View style={styles.optionRow}>
							{NOTE_TYPE_OPTIONS.map((option) => {
								const selected = noteType === option.value;
								return (
									<TouchableOpacity
										key={option.value}
										style={[
											styles.optionChip,
											selected && styles.optionChipSelected,
										]}
										onPress={() => {
											if (!capabilities.canWrite) return;
											setNoteType(option.value);
											if (option.value === "todo") {
												setTodoStatus((current) => current ?? "open");
											} else {
												setTodoStatus(undefined);
											}
										}}
										disabled={!capabilities.canWrite}
									>
										<Text
											style={[
												styles.optionChipText,
												selected && styles.optionChipTextSelected,
											]}
										>
											{option.label}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
					{noteType === "todo" ? (
						<View style={styles.metadataGroup}>
							<Text style={styles.metadataLabel}>Status</Text>
							<View style={styles.optionRow}>
								{TODO_STATUS_OPTIONS.map((option) => {
									const selected = (todoStatus ?? "open") === option.value;
									return (
										<TouchableOpacity
											key={option.value}
											style={[
												styles.optionChip,
												selected && styles.optionChipSelected,
											]}
											onPress={() => {
												if (!capabilities.canWrite) return;
												setTodoStatus(option.value);
											}}
											disabled={!capabilities.canWrite}
										>
											<Text
												style={[
													styles.optionChipText,
													selected && styles.optionChipTextSelected,
												]}
											>
												{option.label}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					) : null}
				</View>

				<Suspense fallback={<Loader />}>
					<LazyEditorToolbar disabled={!capabilities.canWrite} />
					<EditorScrollProvider>
						<LazyHybridEditor />
					</EditorScrollProvider>
				</Suspense>
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
		metadataSection: {
			gap: 10,
			marginBottom: 14,
		},
		metadataGroup: {
			gap: 6,
		},
		metadataLabel: {
			fontSize: 12,
			fontWeight: "600",
			color: theme.colors.textMuted,
			textTransform: "uppercase",
		},
		optionRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: 8,
		},
		optionChip: {
			borderRadius: 999,
			borderWidth: 1,
			borderColor: theme.colors.border,
			paddingHorizontal: 10,
			paddingVertical: 6,
			backgroundColor: theme.colors.card,
		},
		optionChipSelected: {
			backgroundColor: theme.colors.primary,
			borderColor: theme.colors.primary,
		},
		optionChipText: {
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		optionChipTextSelected: {
			color: theme.colors.primaryContrast,
		},
	});
}
