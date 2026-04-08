import NoteEditorHeader from "@/components/NoteEditorHeader";
import TemplatePickerModal from "@/components/TemplatePickerModal";
import { FilterChip } from "@/components/shared/FilterChip";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useStyles } from "@/hooks/useStyles";
import { GitService } from "@/services/git/gitService";
import {
  copyPickedAttachmentToNote,
  deleteAttachment,
  inferAttachmentType,
  type AttachmentType,
} from "@/services/notes/attachmentStorage";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import { deriveNoteType } from "@/services/notes/noteTypeDerivation";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import { createParagraphBlock } from "@/components/editor/core/BlockNode";
import { type EditorState, useEditorState } from "@/stores/editorStore";
import { useToastStore } from "@/stores/toastStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { DocumentPanel } from "./editor/document/DocumentPanel";
import { EditorScrollProvider } from "./editor/EditorScrollContext";
import { EditorToolbar } from "./editor/EditorToolbar";
import { HybridEditor } from "./editor/HybridEditor";

const SPLIT_RATIO_KEY = "doc-split-ratio";

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
  const { focusBlock } = useFocusBlock();
  const styles = useStyles(createStyles);
  const id = note.id;
  const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
  const [title, setTitle] = useState<string>(note.title);
  const [todoStatus, setTodoStatus] = useState<Note["status"]>(
    note.noteType === "todo" ? (note.status ?? "open") : undefined,
  );

  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const showToast = useToastStore((s) => s.showToast);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web";

  const [attachmentPath, setAttachmentPath] = useState<string | null>(
    note.attachment ?? null,
  );
  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(
    () => (note.attachment ? inferAttachmentType(note.attachment) : null),
  );
  const [splitRatio, setSplitRatio] = useState(isDesktop ? 0.5 : 0.4);

  useEffect(() => {
    AsyncStorage.getItem(SPLIT_RATIO_KEY).then((val) => {
      if (val) setSplitRatio(Number.parseFloat(val));
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          const delta = isDesktop
            ? gestureState.dx / windowWidth
            : gestureState.dy / (windowWidth * (9 / 16));
          setSplitRatio((r) => Math.min(0.75, Math.max(0.25, r + delta)));
        },
        onPanResponderRelease: (_, gestureState) => {
          const delta = isDesktop
            ? gestureState.dx / windowWidth
            : gestureState.dy / (windowWidth * (9 / 16));
          setSplitRatio((r) => {
            const next = Math.min(0.75, Math.max(0.25, r + delta));
            AsyncStorage.setItem(SPLIT_RATIO_KEY, String(next));
            return next;
          });
        },
      }),
    [isDesktop, windowWidth],
  );
  const loadMarkdown = useEditorState((s: EditorState) => s.loadMarkdown);
  const loadedNoteIdRef = useRef<string | null>(null);
  const [noteType, setNoteType] = useState<Note["noteType"]>(() =>
    deriveNoteType(note.title),
  );

  const latestDraftRef = useRef({
    title,
    isPinned,
    noteType,
    todoStatus,
  });
  const isNewEntryRef = useRef(!!isNew);
  const isLeavingRef = useRef(false);
  const bypassNextBeforeRemoveRef = useRef(false);
  latestDraftRef.current = {
    title,
    isPinned,
    noteType: deriveNoteType(title),
    todoStatus,
  };

  useEffect(() => {
    const derived = deriveNoteType(title);
    setNoteType(derived);
    setTodoStatus((current) =>
      derived === "todo" ? (current ?? "open") : undefined,
    );
  }, [title]);

  const buildCurrentNotePayload = useCallback(
    (overrides?: Partial<NoteSaveInput>): NoteSaveInput => {
      const draft = latestDraftRef.current;
      const content = useEditorState.getState().getContent();
      const resolvedNoteType =
        overrides?.noteType ?? deriveNoteType(draft.title);
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
    [id],
  );
  const persistCurrentEntry = useCallback(
    async (overrides?: Partial<NoteSaveInput>) => {
      const payload = buildCurrentNotePayload(overrides);
      const isNewEntry = isNewEntryRef.current;
      await persistEditorEntry({
        ...payload,
        isNewEntry,
      });
      isNewEntryRef.current = false;
      return payload;
    },
    [buildCurrentNotePayload],
  );

  const handlePersisted = useCallback(() => {
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

      if (loadedNoteIdRef.current !== note.id) {
        loadedNoteIdRef.current = note.id;
        loadMarkdown(note.content);
      }
    }, [
      loadMarkdown,
      note.content,
      note.id,
      note.isPinned,
      note.noteType,
      note.status,
      note.title,
    ]),
  );

  const handleTogglePin = useCallback(async () => {
    const nextIsPinned = !latestDraftRef.current.isPinned;
    await persistCurrentEntry({ isPinned: nextIsPinned });
    setIsPinned(nextIsPinned);
  }, [persistCurrentEntry]);

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
    await NoteService.deleteNote(id);
    await flushGitAndToastOnFailure(
      "delete",
      `Delete ${latestDraftRef.current.noteType}`,
    );
    bypassNextBeforeRemoveRef.current = true;
    router.back();
  }, [flushGitAndToastOnFailure, id, router]);

  const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);

  const handleTextSelected = useCallback(
    (text: string) => {
      const focusedIndex =
        useEditorState.getState().getFocusedBlockIndex() ?? 0;
      insertBlockAfter(focusedIndex, createParagraphBlock(`> ${text}`));
    },
    [insertBlockAfter],
  );

  const handleAttachDocument = useCallback(async () => {
    let pickedUri: string | null = null;
    let pickedName: string | null = null;

    // Tauri desktop: use @tauri-apps/plugin-dialog directly
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Documents",
          extensions: ["pdf", "epub"],
        },
      ],
    });
    if (!selected) return;
    pickedUri = Array.isArray(selected) ? selected[0] : selected;
    pickedName = pickedUri.split(/[\\/]/).pop() ?? pickedUri;

    const type = inferAttachmentType(pickedName ?? pickedUri ?? "");
    if (!type) {
      showToast("Unsupported file type. Please pick a PDF or ePub.");
      return;
    }
    try {
      const attachmentUri = pickedUri;
      if (!attachmentUri) {
        showToast("Failed to attach document.");
        return;
      }
      const relativePath = await copyPickedAttachmentToNote(attachmentUri, id);
      setAttachmentPath(relativePath);
      setAttachmentType(type);
      await persistCurrentEntry({ attachment: relativePath });
    } catch {
      showToast("Failed to attach document.");
    }
  }, [id, showToast, persistCurrentEntry]);

  const handleRemoveAttachment = useCallback(async () => {
    if (attachmentPath) {
      await deleteAttachment(attachmentPath).catch(() => null);
    }
    setAttachmentPath(null);
    setAttachmentType(null);
    await persistCurrentEntry({ attachment: null });
  }, [attachmentPath, persistCurrentEntry]);

  const applyTitleChange = useCallback((nextTitle: string) => {
    setTitle(nextTitle);
  }, []);

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

  const showSplit = attachmentPath !== null && attachmentType !== null;
  const splitFlexDir = isDesktop ? "row" : "column";

  return (
    <View style={styles.screen}>
      <NoteEditorHeader
        title={title}
        status={status}
        isPinned={isPinned}
        noteType={noteType}
        onChangeTitle={applyTitleChange}
        onBlurTitle={() => {
          const derived = deriveNoteType(title);
          setNoteType(derived);
          setTodoStatus((current) =>
            derived === "todo" ? (current ?? "open") : undefined,
          );
        }}
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

      <View style={[styles.splitContainer, { flexDirection: splitFlexDir }]}>
        {showSplit && (
          <>
            <View
              style={[
                styles.documentPane,
                isDesktop
                  ? { width: `${splitRatio * 100}%` as unknown as number }
                  : { height: `${splitRatio * 100}%` as unknown as number },
              ]}
            >
              <DocumentPanel
                noteId={id}
                attachmentPath={attachmentPath}
                attachmentType={attachmentType}
                onTextSelected={handleTextSelected}
                onDismiss={handleRemoveAttachment}
              />
            </View>
            <View
              style={isDesktop ? styles.dividerV : styles.dividerH}
              {...panResponder.panHandlers}
            />
          </>
        )}

        <View style={styles.editorPane}>
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

            <EditorToolbar
              onAttachDocument={() => void handleAttachDocument()}
              hasAttachment={showSplit}
              onRemoveAttachment={() => void handleRemoveAttachment()}
            />
            <EditorScrollProvider>
              <HybridEditor
                onInsertTemplateCommand={() => {
                  setIsTemplateModalVisible(true);
                }}
              />
            </EditorScrollProvider>
          </View>
        </View>
      </View>

      <TemplatePickerModal
        visible={isTemplateModalVisible}
        onDismiss={() => setIsTemplateModalVisible(false)}
      />
    </View>
  );
}

function createStyles(theme: ExtendedTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    splitContainer: {
      flex: 1,
    },
    documentPane: {
      overflow: "hidden",
    },
    dividerV: {
      width: 4,
      backgroundColor: theme.colors.border,
    },
    dividerH: {
      height: 4,
      backgroundColor: theme.colors.border,
    },
    editorPane: {
      flex: 1,
      overflow: "hidden",
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
  });
}
