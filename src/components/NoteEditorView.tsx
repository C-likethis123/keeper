import { SaveIndicator } from "@/components/SaveIndicator";
import type { EditorState } from "@/components/editor/core/EditorState";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import { TemplateService } from "@/services/notes/templateService";
import type { Note, NoteTemplate } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
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
	Alert,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
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

const NOTE_TYPE_OPTIONS = [
	{ label: "Note", value: "note" },
	{ label: "Journal", value: "journal" },
	{ label: "Resource", value: "resource" },
	{ label: "Todo", value: "todo" },
	{ label: "Template", value: "template" },
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
	const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
	const [templates, setTemplates] = useState<NoteTemplate[]>([]);
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
					draft.noteType === "todo" ? (draft.todoStatus ?? "open") : undefined,
				...overrides,
			};
		},
		[id],
	);

	const persistCurrentEntry = useCallback(
		async (overrides?: Partial<Note>) => {
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
		await persistCurrentEntry();
		router.back();
	}, [persistCurrentEntry, router]);

	const handleDeletePress = useCallback(async () => {
		if (latestDraftRef.current.noteType === "template") {
			await TemplateService.deleteTemplate(id);
		} else {
			await NoteService.deleteNote(id);
		}
		router.back();
	}, [id, router]);

	const openTemplateModal = useCallback(async () => {
		setIsTemplateModalVisible(true);
		setIsLoadingTemplates(true);
		try {
			setTemplates(await TemplateService.listTemplates());
		} catch (error) {
			console.warn("Failed to load templates:", error);
			showToast("Failed to load templates");
		} finally {
			setIsLoadingTemplates(false);
		}
	}, [showToast]);

	const applyTemplate = useCallback(
		(template: NoteTemplate) => {
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

	const { status } = useAutoSave({
		...note,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? (todoStatus ?? "open") : undefined,
		initialNoteType: note.noteType,
		onPersisted: (savedType) => {
			lastPersistedTypeRef.current = savedType;
		},
	});

	useFocusEffect(
		useCallback(() => {
			setIsPinned(!!note.isPinned);
			setTitle(note.title);
			setNoteType(note.noteType);
			setTodoStatus(
				note.noteType === "todo" ? (note.status ?? "open") : undefined,
			);
			lastPersistedTypeRef.current = note.noteType;
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
						disabled={noteType === "template"}
					>
						<MaterialIcons
							name="push-pin"
							size={24}
							color={
								noteType === "template"
									? theme.colors.textFaded
									: isPinned
										? theme.colors.primary
										: theme.colors.textMuted
							}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => {
							void handleDeletePress();
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
		theme.colors.textFaded,
		isPinned,
		noteType,
		status,
	]);

	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.screen}>
			<View style={styles.content}>
				<TextInput
					style={styles.titleInput}
					value={title}
					onChangeText={setTitle}
					editable
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
											setNoteType(option.value);
											if (option.value === "todo") {
												setTodoStatus((current) => current ?? "open");
											} else {
												setTodoStatus(undefined);
											}
											if (option.value === "template") {
												setIsPinned(false);
											}
										}}
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
					{noteType !== "template" ? (
						<View style={styles.metadataGroup}>
							<Text style={styles.metadataLabel}>Template</Text>
							<View style={styles.optionRow}>
								<TouchableOpacity
									style={styles.secondaryActionChip}
									onPress={() => {
										void openTemplateModal();
									}}
								>
									<MaterialIcons
										name="content-copy"
										size={16}
										color={theme.colors.text}
									/>
									<Text style={styles.secondaryActionChipText}>
										Insert from template
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					) : null}
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
												setTodoStatus(option.value);
											}}
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
					<LazyEditorToolbar />
					<EditorScrollProvider>
						<LazyHybridEditor />
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
			padding: 16,
			paddingBottom: 16 + TOOLBAR_HEIGHT,
			backgroundColor: theme.colors.background,
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
