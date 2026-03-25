import { SaveIndicator } from "@/components/SaveIndicator";
import type { EditorState } from "@/components/editor/core/EditorState";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import {
	clearVideoPosition,
	getVideoPosition,
	saveVideoPosition,
} from "@/components/editor/video/videoPositionStore";
import {
	type EmbeddedVideoSource,
	getEmbeddedVideoLayout,
	getResumeEmbedUrl,
	parseEmbeddedVideoUrl,
} from "@/components/editor/video/videoUtils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { appEvents } from "@/services/appEvents";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import { deriveNoteType } from "@/services/notes/noteTypeDerivation";
import { TemplateService } from "@/services/notes/templateService";
import type { Note, NoteTemplate } from "@/services/notes/types";
import { isTauriRuntime } from "@/services/storage/runtime";
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
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	useWindowDimensions,
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
	const [templates, setTemplates] = useState<NoteTemplate[]>([]);
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
	const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);
	const [videoInput, setVideoInput] = useState("");
	const [embeddedVideo, setEmbeddedVideo] = useState<EmbeddedVideoSource | null>(
		null,
	);
	const [desktopVideoPanelWidth, setDesktopVideoPanelWidth] = useState(420);
	const [stackedSplitRatio, setStackedSplitRatio] = useState(0.45);
	const [videoStartSeconds, setVideoStartSeconds] = useState(0);
	const latestVideoTimeRef = useRef(0);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
	const { width } = useWindowDimensions();
	const latestDraftRef = useRef({
		title,
		isPinned,
		noteType,
		todoStatus,
	});
	const lastPersistedTypeRef = useRef<Note["noteType"]>(note.noteType);
	const videoLayout = getEmbeddedVideoLayout(
		width,
		Platform.OS,
		isTauriRuntime(),
	);

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

	useEffect(() => {
		return appEvents.on("forceSave", () => {
			void persistCurrentEntry();
		});
	}, [persistCurrentEntry]);

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
		if (embeddedVideo) {
			await saveVideoPosition(embeddedVideo.rawUrl, latestVideoTimeRef.current);
		}
		await persistCurrentEntry();
		router.back();
	}, [persistCurrentEntry, router, embeddedVideo]);

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

	const openVideoModal = useCallback(() => {
		setVideoInput(embeddedVideo?.rawUrl ?? "");
		setIsVideoModalVisible(true);
	}, [embeddedVideo?.rawUrl]);

	const handleSubmitVideoUrl = useCallback(async () => {
		const parsed = parseEmbeddedVideoUrl(videoInput);
		if (!parsed) {
			showToast("Enter a valid video URL");
			return;
		}

		const savedTime = await getVideoPosition(parsed.rawUrl);
		setVideoStartSeconds(savedTime);
		latestVideoTimeRef.current = savedTime;
		setEmbeddedVideo(parsed);
		setIsVideoModalVisible(false);
		showToast(`Opened ${parsed.label}`);
	}, [showToast, videoInput]);

	const handleCloseVideo = useCallback(async () => {
		if (embeddedVideo) {
			await saveVideoPosition(embeddedVideo.rawUrl, latestVideoTimeRef.current);
		}
		setEmbeddedVideo(null);
	}, [embeddedVideo]);

	const handleIncreasePanelWidth = useCallback(() => {
		setDesktopVideoPanelWidth((current) => Math.min(current + 40, 720));
	}, []);

	const handleDecreasePanelWidth = useCallback(() => {
		setDesktopVideoPanelWidth((current) => Math.max(current - 40, 280));
	}, []);

	const handleIncreaseStackedRatio = useCallback(() => {
		setStackedSplitRatio((r) => Math.min(r + 0.05, 0.65));
	}, []);

	const handleDecreaseStackedRatio = useCallback(() => {
		setStackedSplitRatio((r) => Math.max(r - 0.05, 0.25));
	}, []);

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
			const derived = deriveNoteType(note.title);
			setNoteType(derived);
			setTodoStatus(derived === "todo" ? (note.status ?? "open") : undefined);
			lastPersistedTypeRef.current = derived;
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

	const editorPane = (
		<Suspense fallback={<Loader />}>
			<LazyEditorToolbar />
			<EditorScrollProvider>
				<LazyHybridEditor />
			</EditorScrollProvider>
		</Suspense>
	);

	const videoAndEditorBlock =
		embeddedVideo && videoLayout === "side" ? (
			<View style={styles.sideBySideShell}>
				<View style={styles.editorPane}>{editorPane}</View>
				<View style={{ width: desktopVideoPanelWidth }}>
					<EmbeddedVideoPanel
						layout={videoLayout}
						onClose={() => void handleCloseVideo()}
						onGrow={handleIncreasePanelWidth}
						onShrink={handleDecreasePanelWidth}
						onTimeUpdate={(t) => {
							latestVideoTimeRef.current = t;
						}}
						source={embeddedVideo}
						startSeconds={videoStartSeconds}
					/>
				</View>
			</View>
		) : embeddedVideo && videoLayout === "stacked" ? (
			<View style={styles.stackedSplitShell}>
				<View style={{ flex: stackedSplitRatio }}>
					<EmbeddedVideoPanel
						layout={videoLayout}
						onClose={() => void handleCloseVideo()}
						onGrow={handleIncreaseStackedRatio}
						onShrink={handleDecreaseStackedRatio}
						onTimeUpdate={(t) => {
							latestVideoTimeRef.current = t;
						}}
						source={embeddedVideo}
						startSeconds={videoStartSeconds}
					/>
				</View>
				<View style={{ flex: 1 - stackedSplitRatio }}>{editorPane}</View>
			</View>
		) : (
			editorPane
		);

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
					<View style={styles.metadataGroup}>
						<Text style={styles.metadataLabel}>Video</Text>
						<View style={styles.optionRow}>
							<TouchableOpacity
								style={styles.secondaryActionChip}
								onPress={openVideoModal}
							>
								<MaterialIcons
									name="smart-display"
									size={16}
									color={theme.colors.text}
								/>
								<Text style={styles.secondaryActionChipText}>
									{embeddedVideo ? "Change video" : "Open video"}
								</Text>
							</TouchableOpacity>
							{embeddedVideo ? (
								<TouchableOpacity
									style={styles.secondaryActionChip}
									onPress={handleCloseVideo}
								>
									<MaterialIcons
										name="close"
										size={16}
										color={theme.colors.text}
									/>
									<Text style={styles.secondaryActionChipText}>Close video</Text>
								</TouchableOpacity>
							) : null}
						</View>
					</View>
				</View>

				{videoAndEditorBlock}
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

			<Modal
				visible={isVideoModalVisible}
				animationType="fade"
				transparent
				onRequestClose={() => {
					setIsVideoModalVisible(false);
				}}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Paste video URL</Text>
							<TouchableOpacity
								onPress={() => {
									setIsVideoModalVisible(false);
								}}
							>
								<MaterialIcons
									name="close"
									size={22}
									color={theme.colors.text}
								/>
							</TouchableOpacity>
						</View>
						<Text style={styles.emptyTemplatesText}>
							Paste a YouTube link or another embeddable video URL.
						</Text>
						<TextInput
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							onChangeText={setVideoInput}
							placeholder="https://www.youtube.com/watch?v=..."
							placeholderTextColor={theme.custom.editor.placeholder}
							style={styles.videoUrlInput}
							testID="video-url-input"
							value={videoInput}
						/>
						<View style={styles.videoModalActions}>
							<TouchableOpacity
								onPress={() => {
									setIsVideoModalVisible(false);
								}}
								style={styles.secondaryActionChip}
							>
								<Text style={styles.secondaryActionChipText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleSubmitVideoUrl}
								style={styles.primaryActionChip}
							>
								<Text style={styles.primaryActionChipText}>Open video</Text>
							</TouchableOpacity>
						</View>
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
			gap: 14,
		},
		titleInput: {
			fontSize: 20,
			fontWeight: "600",
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
		primaryActionChip: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderRadius: 999,
			backgroundColor: theme.colors.primary,
		},
		primaryActionChipText: {
			fontSize: 13,
			fontWeight: "700",
			color: theme.colors.primaryContrast,
		},
		sideBySideShell: {
			flex: 1,
			flexDirection: "row",
			alignItems: "stretch",
			gap: 16,
			minHeight: 0,
		},
		editorPane: {
			flex: 1,
			minWidth: 0,
		},
		stackedSplitShell: {
			flex: 1,
			flexDirection: "column",
			gap: 8,
			minHeight: 0,
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
		videoUrlInput: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 12,
			paddingHorizontal: 12,
			paddingVertical: 10,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		videoModalActions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 8,
			marginTop: 12,
		},
	});
}
