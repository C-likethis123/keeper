import NoteEditorHeader from "@/components/NoteEditorHeader";
import type { EditorState } from "@/components/editor/core/EditorState";
import { FilterChip } from "@/components/shared/FilterChip";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { GitService } from "@/services/git/gitService";
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
import { EditorToolbar } from "./editor/EditorToolbar";
import { HybridEditor } from "./editor/HybridEditor";
import Loader from "./shared/Loader";

// TODO: refactor so we can do away with this???
const TODO_STATUS_OPTIONS = [
	{ label: "Open", value: "open" },
	{ label: "Doing", value: "doing" },
	{ label: "Blocked", value: "blocked" },
	{ label: "Done", value: "done" },
] as const;

export default function NoteEditorView({
	note,
	isNew,
}: {
	note: Note;
	isNew?: boolean;
}) {
	const navigation = useNavigation();
	const router = useRouter();
	const theme = useExtendedTheme();
	const { focusBlock } = useFocusBlock();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const id = note.id;
	const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
	const [title, setTitle] = useState<string>(note.title);
	const [todoStatus, setTodoStatus] = useState<Note["status"]>(
		note.noteType === "todo" ? (note.status ?? "open") : undefined,
	);

	const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
	const [templates, setTemplates] = useState<Note[]>([]);
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	const editorContent = useEditorState((s: EditorState) =>
		s.getContentForVersion(s.document.version),
	);
	const deriveCurrentNoteType = useCallback(
		(nextTitle: string, nextContent: string): Note["noteType"] => {
			const derived = deriveNoteType(nextTitle, nextContent);
			const isUnchangedExistingNote =
				!isNew &&
				nextTitle === note.title &&
				nextContent === note.content &&
				note.noteType !== "note";
			if (derived === "note" && isUnchangedExistingNote) {
				return note.noteType;
			}
			return derived;
		},
		[isNew, note.content, note.noteType, note.title],
	);
	const [noteType, setNoteType] = useState<Note["noteType"]>(() =>
		deriveCurrentNoteType(note.title, note.content),
	);
	const latestDraftRef = useRef({
		title,
		isPinned,
		noteType,
		todoStatus,
	});
	const lastPersistedTypeRef = useRef<Note["noteType"]>(note.noteType);
	const isNewEntryRef = useRef(!!isNew);
	const isLeavingRef = useRef(false);
	const bypassNextBeforeRemoveRef = useRef(false);

	latestDraftRef.current = {
		title,
		isPinned,
		noteType: deriveCurrentNoteType(title, editorContent),
		todoStatus,
	};

	useEffect(() => {
		const derived = deriveCurrentNoteType(title, editorContent);
		setNoteType(derived);
		setTodoStatus((current) =>
			derived === "todo" ? (current ?? "open") : undefined,
		);
		if (derived === "template") {
			setIsPinned(false);
		}
	}, [deriveCurrentNoteType, editorContent, title]);

	const buildCurrentNotePayload = useCallback(
		(overrides?: Partial<NoteSaveInput>): NoteSaveInput => {
			const draft = latestDraftRef.current;
			const content = useEditorState.getState().getContent();
			const resolvedNoteType =
				overrides?.noteType ?? deriveCurrentNoteType(draft.title, content);
			const resolvedIsPinned =
				(overrides?.isPinned ?? draft.isPinned) &&
				resolvedNoteType !== "template";
			return {
				id,
				title: draft.title,
				content,
				isPinned: resolvedIsPinned,
				noteType: resolvedNoteType,
				status:
					resolvedNoteType === "todo"
						? (overrides?.status ?? draft.todoStatus ?? "open")
						: null,
				...overrides,
			};
		},
		[deriveCurrentNoteType, id],
	);

	const persistCurrentEntry = useCallback(
		async (overrides?: Partial<NoteSaveInput>) => {
			const payload = buildCurrentNotePayload(overrides);
			const isNewEntry = isNewEntryRef.current;
			await persistEditorEntry({
				...payload,
				previousNoteType: lastPersistedTypeRef.current,
				isNewEntry,
			});
			lastPersistedTypeRef.current = payload.noteType;
			isNewEntryRef.current = false;
			return payload;
		},
		[buildCurrentNotePayload],
	);

	const handlePersisted = useCallback((savedType: Note["noteType"]) => {
		lastPersistedTypeRef.current = savedType;
		isNewEntryRef.current = false;
	}, []);

	const { status, forceSave } = useAutoSave({
		...note,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? (todoStatus ?? "open") : null,
		initialNoteType: note.noteType,
		onPersisted: handlePersisted,
		isNew,
	});
	useAppKeyboardShortcuts({
		onForceSave: forceSave,
	});

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

	const flushGitAndToastOnFailure = useCallback(
		async (
			reason: "note-exit" | "delete",
			message?: string,
		): Promise<boolean> => {
			const result = await GitService.flushPendingChanges({
				reason,
				message,
				timeoutMs: 8000,
			});
			if (!result.success) {
				showToast("Saved locally. Sync will retry shortly.");
			}
			return result.success;
		},
		[showToast],
	);

	const leaveEditor = useCallback(
		async (action?: { type: string; payload?: object }) => {
			if (isLeavingRef.current) {
				return;
			}

			isLeavingRef.current = true;
			try {
				await forceSave();
				await flushGitAndToastOnFailure("note-exit");
				bypassNextBeforeRemoveRef.current = true;
				if (action) {
					navigation.dispatch(action);
					return;
				}
				router.back();
			} finally {
				isLeavingRef.current = false;
			}
		},
		[flushGitAndToastOnFailure, forceSave, navigation, router],
	);

	const handleDeletePress = useCallback(async () => {
		await NoteService.deleteNote(id, latestDraftRef.current.noteType);
		await flushGitAndToastOnFailure(
			"delete",
			`Delete ${latestDraftRef.current.noteType}`,
		);
		bypassNextBeforeRemoveRef.current = true;
		router.back();
	}, [flushGitAndToastOnFailure, id, router]);

	const applyTitleChange = useCallback(
		(nextTitle: string) => {
			setTitle(nextTitle);
		},
		[],
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
		async (template: Note) => {
			const currentContent = useEditorState.getState().getContent();
			const replaceBody = async () => {
				try {
					const fullTemplate = await NoteService.loadNote(template.id);
					if (!fullTemplate) {
						showToast("Template not found");
						return;
					}
					loadMarkdown(fullTemplate.content);
					setIsTemplateModalVisible(false);
					showToast(
						`Applied template "${fullTemplate.title || "Untitled"}"`,
					);
				} catch (error) {
					console.warn("Failed to apply template:", error);
					showToast("Failed to apply template");
				}
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
							onPress: () => {
								void replaceBody();
							},
						},
					],
				);
				return;
			}

			await replaceBody();
		},
		[loadMarkdown, showToast],
	);
	useLayoutEffect(() => {
		navigation.setOptions({
			headerShown: false,
		});
	}, [navigation]);

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (event) => {
			if (bypassNextBeforeRemoveRef.current) {
				bypassNextBeforeRemoveRef.current = false;
				return;
			}

			event.preventDefault();
			void leaveEditor(event.data.action);
		});

		return unsubscribe;
	}, [leaveEditor, navigation]);

	return (
		<View style={styles.screen}>
			<NoteEditorHeader
				title={title}
				status={status}
				isPinned={isPinned}
				noteType={noteType}
				onChangeTitle={applyTitleChange}
				onBlurTitle={() => setNoteType(deriveNoteType(title))}
				onSubmitEditing={() => focusBlock(0)}
				onBack={() => {
					void leaveEditor();
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

				<EditorToolbar />
				<EditorScrollProvider>
					<HybridEditor
						onInsertTemplateCommand={() => {
							void openTemplateModal();
						}}
					/>
				</EditorScrollProvider>
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
											void applyTemplate(template);
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
