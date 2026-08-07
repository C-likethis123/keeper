import NoteEditorHeader from "@/components/NoteEditorHeader";
import NoteHistoryModal from "@/components/NoteHistoryModal";
import DrawingCanvas from "@/components/drawing/DrawingCanvas";
import DrawingToolbar from "@/components/drawing/DrawingToolbar";
import {
	type DrawingBackgroundPattern,
	type DrawingDocument,
	type DrawingTool,
	createEmptyDrawingDocument,
	parseDrawingDocument,
	serializeDrawingDocument,
} from "@/components/drawing/drawingDocument";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { showToast } from "@/services/toast";
import { useTabStore } from "@/stores/tabStore";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { StyleSheet, View } from "react-native";

const BACKGROUND_PATTERNS: DrawingBackgroundPattern[] = [
	"none",
	"grid",
	"dots",
	"ruled",
];

export default function DrawingEditorView({
	note,
	isNew,
}: {
	note: Note;
	isNew?: boolean;
}) {
	const navigation = useNavigation();
	const router = useRouter();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);
	const id = note.id;
	const [title, setTitle] = useState(note.title);
	const [isPinned, setIsPinned] = useState(!!note.isPinned);
	const [document, setDocument] = useState<DrawingDocument>(() =>
		parseDrawingDocument(note.content),
	);
	const [tool, setTool] = useState<DrawingTool | "eraser">("pen");
	const [color, setColor] = useState("#202124");
	const [strokeWidth, setStrokeWidth] = useState(4);
	const [undoStack, setUndoStack] = useState<DrawingDocument[]>([]);
	const [redoStack, setRedoStack] = useState<DrawingDocument[]>([]);
	const [contentRevision, setContentRevision] = useState(0);
	const [isHistoryVisible, setIsHistoryVisible] = useState(false);
	const [historyNote, setHistoryNote] = useState(note);
	const documentRef = useRef(document);
	const contentRef = useRef(serializeDrawingDocument(document));
	const isLeavingRef = useRef(false);
	const bypassNextBeforeRemoveRef = useRef(false);
	const { updateTabTitle, tabs, closeTab, markTabPersisted } = useTabStore();
	const tab = tabs.find((candidate) => candidate.noteId === id);

	const serializedContent = useMemo(
		() => serializeDrawingDocument(document),
		[document],
	);
	documentRef.current = document;
	contentRef.current = serializedContent;

	const getCurrentContent = useCallback(() => contentRef.current, []);
	const handlePersisted = useCallback(
		() => markTabPersisted(id),
		[id, markTabPersisted],
	);
	const { status, forceSave } = useAutoSave({
		...note,
		content: note.content,
		currentContent: serializedContent,
		currentContentRevision: contentRevision,
		getCurrentContent,
		title,
		isPinned,
		noteType: "drawing",
		initialNoteType: "drawing",
		onPersisted: handlePersisted,
		isNew,
	});

	const applyDocument = useCallback((next: DrawingDocument) => {
		documentRef.current = next;
		contentRef.current = serializeDrawingDocument(next);
		setDocument(next);
		setContentRevision((revision) => revision + 1);
	}, []);

	const commitDocument = useCallback(
		(next: DrawingDocument) => {
			const current = documentRef.current;
			if (next === current) return;
			setUndoStack((stack) => [...stack.slice(-49), current]);
			setRedoStack([]);
			applyDocument(next);
		},
		[applyDocument],
	);

	const handleUndo = useCallback(() => {
		setUndoStack((stack) => {
			const previous = stack.at(-1);
			if (!previous) return stack;
			setRedoStack((redo) => [...redo.slice(-49), documentRef.current]);
			applyDocument(previous);
			return stack.slice(0, -1);
		});
	}, [applyDocument]);

	const handleRedo = useCallback(() => {
		setRedoStack((stack) => {
			const next = stack.at(-1);
			if (!next) return stack;
			setUndoStack((undo) => [...undo.slice(-49), documentRef.current]);
			applyDocument(next);
			return stack.slice(0, -1);
		});
	}, [applyDocument]);

	const handleCycleBackground = useCallback(() => {
		const current = documentRef.current;
		const index = BACKGROUND_PATTERNS.indexOf(current.background.pattern);
		const pattern =
			BACKGROUND_PATTERNS[(index + 1) % BACKGROUND_PATTERNS.length];
		commitDocument({
			...current,
			background: { ...current.background, pattern },
		});
	}, [commitDocument]);

	const saveBeforeExit = useCallback(async () => {
		try {
			await forceSave();
			return true;
		} catch {
			showToast("Failed to save drawing.");
			return false;
		}
	}, [forceSave]);

	const leaveEditor = useCallback(
		async (action?: { type: string; payload?: object }) => {
			if (isLeavingRef.current) return;
			isLeavingRef.current = true;
			try {
				if (!(await saveBeforeExit())) return;
				bypassNextBeforeRemoveRef.current = true;
				if (action) navigation.dispatch(action);
				else router.back();
			} finally {
				isLeavingRef.current = false;
			}
		},
		[navigation, router, saveBeforeExit],
	);

	const handleBack = useCallback(async () => {
		if (tabs.length === 1 && tab && !tab.isPinned) {
			if (!(await saveBeforeExit())) return;
			bypassNextBeforeRemoveRef.current = true;
			closeTab(tab.id);
			router.replace("/");
			return;
		}
		await leaveEditor();
	}, [closeTab, leaveEditor, router, saveBeforeExit, tab, tabs.length]);

	const handleDelete = useCallback(async () => {
		await NoteService.deleteNote(id);
		bypassNextBeforeRemoveRef.current = true;
		if (tab) closeTab(tab.id);
		router.replace("/");
	}, [closeTab, id, router, tab]);

	const handleTogglePin = useCallback(() => {
		setIsPinned((pinned) => !pinned);
	}, []);

	const handleShowHistory = useCallback(async () => {
		try {
			await forceSave();
			const persisted = await NoteService.loadNote(id);
			if (persisted) setHistoryNote(persisted);
			setIsHistoryVisible(true);
		} catch {
			showToast("Failed to open version history.");
		}
	}, [forceSave, id]);

	const handleRestoreVersion = useCallback(
		async (versionId: string) => {
			const restored = await NoteService.restoreNoteVersion(id, versionId);
			setTitle(restored.title);
			setIsPinned(restored.isPinned);
			applyDocument(parseDrawingDocument(restored.content));
			setUndoStack([]);
			setRedoStack([]);
			if (tab) updateTabTitle(tab.id, restored.title);
			setHistoryNote(restored);
			showToast("Version restored.");
		},
		[applyDocument, id, tab, updateTabTitle],
	);

	useAppKeyboardShortcuts({ onForceSave: forceSave });

	useEffect(() => {
		if (typeof globalThis.document === "undefined") return;
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
				return;
			}
			event.preventDefault();
			if (event.shiftKey) handleRedo();
			else handleUndo();
		};
		globalThis.document.addEventListener("keydown", handleKeyDown, true);
		return () =>
			globalThis.document.removeEventListener("keydown", handleKeyDown, true);
	}, [handleRedo, handleUndo]);

	useEffect(() => {
		if (tab && title && tab.title !== title) updateTabTitle(tab.id, title);
	}, [tab, title, updateTabTitle]);

	useFocusEffect(
		useCallback(() => {
			setTitle(note.title);
			setIsPinned(!!note.isPinned);
			const next = note.content
				? parseDrawingDocument(note.content)
				: createEmptyDrawingDocument();
			applyDocument(next);
			setUndoStack([]);
			setRedoStack([]);
		}, [applyDocument, note.content, note.isPinned, note.title]),
	);

	useLayoutEffect(() => {
		navigation.setOptions({ headerShown: false });
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
				noteType="drawing"
				onChangeTitle={setTitle}
				onBlurTitle={() => void forceSave()}
				onSubmitEditing={() => void forceSave()}
				onBack={() => void handleBack()}
				onShowHistory={() => void handleShowHistory()}
				onTogglePin={handleTogglePin}
				onDelete={() => void handleDelete()}
			/>
			<View style={styles.canvasShell}>
				<DrawingCanvas
					document={document}
					tool={tool}
					color={color}
					strokeWidth={strokeWidth}
					onChange={commitDocument}
				/>
			</View>
			<DrawingToolbar
				tool={tool}
				color={color}
				strokeWidth={strokeWidth}
				backgroundPattern={document.background.pattern}
				canUndo={undoStack.length > 0}
				canRedo={redoStack.length > 0}
				onToolChange={setTool}
				onColorChange={setColor}
				onWidthChange={setStrokeWidth}
				onCycleBackground={handleCycleBackground}
				onUndo={handleUndo}
				onRedo={handleRedo}
			/>
			<NoteHistoryModal
				visible={isHistoryVisible}
				note={historyNote}
				onDismiss={() => setIsHistoryVisible(false)}
				onRestore={handleRestoreVersion}
			/>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		screen: { flex: 1, backgroundColor: theme.colors.background },
		canvasShell: {
			flex: 1,
			backgroundColor: "#ffffff",
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
	});
}
