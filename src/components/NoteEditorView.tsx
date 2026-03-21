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
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, {
	Suspense,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
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
	const navigation = useNavigation();
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
	const latestDraftRef = useRef({
		title,
		isPinned,
		noteType,
		todoStatus,
	});
	const latestCapabilitiesRef = useRef(capabilities);

	latestDraftRef.current = {
		title,
		isPinned,
		noteType,
		todoStatus,
	};
	latestCapabilitiesRef.current = capabilities;

	const buildCurrentNotePayload = useCallback(
		(overrides?: Partial<Note>): Note => {
			const draft = latestDraftRef.current;
			return {
				id,
				title: draft.title,
				content: useEditorState.getState().getContent(),
				isPinned: draft.isPinned,
				lastUpdated: Date.now(),
				noteType: draft.noteType,
				status:
					draft.noteType === "todo"
						? (draft.todoStatus ?? "open")
						: undefined,
				...overrides,
			};
		},
		[id],
	);

	const handleTogglePin = useCallback(async () => {
		const currentCapabilities = latestCapabilitiesRef.current;
		if (!currentCapabilities.canWrite) {
			showToast(currentCapabilities.reason ?? "Read-only mode");
			return;
		}
		const nextIsPinned = !latestDraftRef.current.isPinned;
		const newNote = buildCurrentNotePayload({ isPinned: nextIsPinned });
		await NoteService.saveNote(newNote);
		setIsPinned(nextIsPinned);
	}, [buildCurrentNotePayload, showToast]);

	const handleBackPress = useCallback(async () => {
		const currentCapabilities = latestCapabilitiesRef.current;
		if (!currentCapabilities.canWrite) {
			router.back();
			return;
		}
		await NoteService.saveNote(buildCurrentNotePayload());
		router.back();
	}, [buildCurrentNotePayload, router]);

	const handleDeletePress = useCallback(async () => {
		const currentCapabilities = latestCapabilitiesRef.current;
		if (!currentCapabilities.canWrite) {
			showToast(currentCapabilities.reason ?? "Read-only mode");
			return;
		}
		await NoteService.deleteNote(id);
		router.back();
	}, [id, router, showToast]);

	const { status } = useAutoSave({
		...note,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? (todoStatus ?? "open") : undefined,
	});

	useFocusEffect(
		useCallback(() => {
			setIsPinned(!!note.isPinned);
			setTitle(note.title);
			setNoteType(note.noteType);
			setTodoStatus(note.noteType === "todo" ? (note.status ?? "open") : undefined);
			loadMarkdown(note.content);
		}, [loadMarkdown, note]),
	);

	useLayoutEffect(() => {
		navigation.setOptions({
			title: "Editor",
			headerLeft: () => (
				<TouchableOpacity
					onPress={() => {
						void handleBackPress();
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
						onPress={() => {
							void handleTogglePin();
						}}
						style={{ marginRight: 8 }}
						disabled={!capabilities.canWrite}
					>
						<MaterialIcons
							name="push-pin"
							size={24}
							color={isPinned ? theme.colors.primary : theme.colors.textMuted}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => {
							void handleDeletePress();
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
		});
	}, [
		navigation,
		handleBackPress,
		handleDeletePress,
		handleTogglePin,
		theme.colors.text,
		theme.colors.primary,
		theme.colors.textMuted,
		capabilities.canWrite,
		isPinned,
		status,
	]);

	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.screen}>
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
