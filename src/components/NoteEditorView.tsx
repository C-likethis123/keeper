import NoteEditorHeader from "@/components/NoteEditorHeader";
import type { EditorState } from "@/components/editor/core/EditorState";
import { FilterChip } from "@/components/shared/FilterChip";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { appEvents } from "@/services/appEvents";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import { deriveNoteType } from "@/services/notes/noteTypeDerivation";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, {
	Suspense,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Alert,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { EditorScrollProvider } from "./editor/EditorScrollContext";
import Loader from "./shared/Loader";

const LazyEditorToolbar = React.lazy(() =>
	import("@/components/editor/EditorToolbar").then((module) => ({
		default: module.EditorToolbar,
	})),
);

const LazyHybridEditor = React.lazy(() =>
	import("@/components/editor/HybridEditor").then((module) => ({
		default: module.HybridEditor,
	})),
);

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
	const styles = useMemo(() => createStyles(theme), [theme]);
	const id = note.id;
	const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
	const [title, setTitle] = useState<string>(note.title);
	const [noteType, setNoteType] = useState<Note["noteType"]>(() =>
		deriveNoteType(note.title),
	);
	const [todoStatus, setTodoStatus] = useState<Note["status"]>(
		note.noteType === "todo" ? (note.status ?? "open") : undefined,
	);
	useEffect(() => {
		const derived = deriveNoteType(title);
		setNoteType(derived);
		setTodoStatus((current) =>
			derived === "todo" ? (current ?? "open") : undefined,
		);
		if (derived === "template") {
			setIsPinned(false);
		}
	}, [title]);

	const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
	const [templates, setTemplates] = useState<Note[]>([]);
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	const latestDraftRef = useRef({
		title,
		isPinned,
		noteType,
		todoStatus,
	});
	const lastPersistedTypeRef = useRef<Note["noteType"]>(note.noteType);

	latestDraftRef.current = {
		title,
		isPinned,
		noteType,
		todoStatus,
	};

	const buildCurrentNotePayload = useCallback(
		(overrides?: Partial<NoteSaveInput>): NoteSaveInput => {
			const draft = latestDraftRef.current;
			const resolvedNoteType =
				overrides?.noteType ?? deriveNoteType(draft.title);
			const resolvedIsPinned =
				(overrides?.isPinned ?? draft.isPinned) &&
				resolvedNoteType !== "template";
			return {
				id,
				title: draft.title,
				content: useEditorState.getState().getContent(),
				isPinned: resolvedIsPinned,
				noteType: resolvedNoteType,
				status:
					resolvedNoteType === "todo"
						? (overrides?.status ?? draft.todoStatus ?? "open")
						: null,
				...overrides,
			};
		},
		[id],
	);

	const persistCurrentEntry = useCallback(
		async (overrides?: Partial<NoteSaveInput>) => {
			const payload = buildCurrentNotePayload(overrides);
			await persistEditorEntry({
				...payload,
				previousNoteType: lastPersistedTypeRef.current,
			});
			lastPersistedTypeRef.current = payload.noteType;
			return payload;
		},
		[buildCurrentNotePayload],
	);

	const handlePersisted = useCallback((savedType: Note["noteType"]) => {
		lastPersistedTypeRef.current = savedType;
	}, []);

	const { status, forceSave } = useAutoSave({
		...note,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? (todoStatus ?? "open") : null,
		initialNoteType: note.noteType,
		onPersisted: handlePersisted,
	});

	useEffect(() => {
		return appEvents.on("forceSave", () => {
			void forceSave();
		});
	}, [forceSave]);

	useFocusEffect(
		useCallback(() => {
			setIsPinned(!!note.isPinned);
			setTitle(note.title);
			setNoteType(note.noteType);
			setTodoStatus(note.noteType === "todo" ? (note.status ?? "open") : null);
			lastPersistedTypeRef.current = note.noteType;
			loadMarkdown(note.content);
		}, [loadMarkdown, note]),
	);

	const handleTogglePin = useCallback(async () => {
		if (latestDraftRef.current.noteType === "template") {
			showToast("Templates can't be pinned");
			return;
		}
		const nextIsPinned = !latestDraftRef.current.isPinned;
		await persistCurrentEntry({ isPinned: nextIsPinned });
		setIsPinned(nextIsPinned);
	}, [persistCurrentEntry, showToast]);

	const handleBackPress = useCallback(async () => {
		await forceSave();
		router.back();
	}, [forceSave, router]);

	const handleDeletePress = useCallback(async () => {
		await NoteService.deleteNote(id, latestDraftRef.current.noteType);
		router.back();
	}, [id, router]);

	const applyTitleChange = useCallback(
		(nextTitle: string) => {
			setTitle(nextTitle);
			const nextType = deriveNoteType(nextTitle);
			setNoteType(nextType);
			setTodoStatus(nextType === "todo" ? (todoStatus ?? "open") : null);
		},
		[todoStatus],
	);

	const openTemplateModal = useCallback(async () => {
		setIsTemplateModalVisible(true);
		setIsLoadingTemplates(true);
		try {
			const result = await NotesIndexService.listNotes("", 100, 0, {
				noteTypes: ["template"],
			});
			const notes: Note[] = result.items.map((item) => ({
				id: item.noteId,
				title: item.title,
				content: item.summary ?? "",
				lastUpdated: item.updatedAt,
				isPinned: item.isPinned,
				noteType: item.noteType,
				status: item.status,
			}));
			setTemplates(notes);
		} catch (error) {
			console.warn("Failed to load templates:", error);
			showToast("Failed to load templates");
		} finally {
			setIsLoadingTemplates(false);
		}
	}, [showToast]);

	const applyTemplate = useCallback(
		(template: Note) => {
			const currentContent = useEditorState.getState().getContent();
			const replaceBody = () => {
				loadMarkdown(template.content);
				setIsTemplateModalVisible(false);
				showToast(`Applied template "${template.title || "Untitled"}"`);
			};

			if (currentContent.trim().length > 0) {
				Alert.alert(
					"Replace note body?",
					`Use "${template.title || "Untitled"}" and replace the current body?`,
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Replace",
							style: "destructive",
							onPress: replaceBody,
						},
					],
				);
				return;
			}

			replaceBody();
		},
		[loadMarkdown, showToast],
	);
	useLayoutEffect(() => {
		navigation.setOptions({
			headerShown: false,
		});
	}, [navigation]);

	return (
		<View style={styles.screen}>
			<NoteEditorHeader
				title={title}
				status={status}
				isPinned={isPinned}
				noteType={noteType}
				onChangeTitle={applyTitleChange}
				onBlurTitle={() => setNoteType(deriveNoteType(title))}
				onBack={() => {
					void handleBackPress();
				}}
				onTogglePin={() => {
					void handleTogglePin();
				}}
				onDelete={() => {
					void handleDeletePress();
				}}
			/>
			<View style={styles.content}>
				{noteType === "todo" ? (
					<View style={styles.metadataGroup}>
						<Text style={styles.metadataLabel}>Status</Text>
						<View style={styles.optionRow}>
							{TODO_STATUS_OPTIONS.map((option) => (
								<FilterChip
									key={option.value}
									label={option.label}
									selected={(todoStatus ?? "open") === option.value}
									onPress={() => setTodoStatus(option.value)}
								/>
							))}
						</View>
					</View>
				) : null}

				<Suspense fallback={<Loader />}>
					<LazyEditorToolbar />
					<EditorScrollProvider>
						<LazyHybridEditor
							onInsertTemplateCommand={() => {
								void openTemplateModal();
							}}
						/>
					</EditorScrollProvider>
				</Suspense>
			</View>

			<Modal
				visible={isTemplateModalVisible}
				animationType="slide"
				transparent
				onRequestClose={() => {
					setIsTemplateModalVisible(false);
				}}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Choose template</Text>
							<TouchableOpacity
								onPress={() => {
									setIsTemplateModalVisible(false);
								}}
							>
								<MaterialIcons
									name="close"
									size={22}
									color={theme.colors.text}
								/>
							</TouchableOpacity>
						</View>
						{isLoadingTemplates ? (
							<Loader />
						) : templates.length === 0 ? (
							<Text style={styles.emptyTemplatesText}>
								No templates yet. Change a note type to Template to create one.
							</Text>
						) : (
							<ScrollView contentContainerStyle={styles.templateList}>
								{templates.map((template) => (
									<TouchableOpacity
										key={template.id}
										style={styles.templateCard}
										onPress={() => {
											applyTemplate(template);
										}}
									>
										<Text style={styles.templateCardTitle}>
											{template.title || "Untitled template"}
										</Text>
										<Text style={styles.templateCardContent} numberOfLines={4}>
											{template.content || "Empty template"}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						)}
					</View>
				</View>
			</Modal>
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
			paddingHorizontal: 16,
			backgroundColor: theme.colors.background,
			gap: 8,
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
		secondaryActionChip: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderRadius: 999,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		secondaryActionChipText: {
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.text,
		},
		modalBackdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		modalCard: {
			maxHeight: "80%",
			borderRadius: 16,
			padding: 16,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		modalHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 12,
		},
		modalTitle: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		emptyTemplatesText: {
			fontSize: 14,
			lineHeight: 20,
			color: theme.colors.textMuted,
		},
		templateList: {
			gap: 10,
		},
		templateCard: {
			borderRadius: 12,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			padding: 12,
			gap: 6,
		},
		templateCardTitle: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
		},
		templateCardContent: {
			fontSize: 13,
			lineHeight: 18,
			color: theme.colors.textMuted,
		},
	});
}
