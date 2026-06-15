import NoteEditorHeader from "@/components/NoteEditorHeader";
import NoteRelatedNotes from "@/components/moc/NoteRelatedNotes";
import TemplatePickerModal from "@/components/TemplatePickerModal";
import { FilterChip } from "@/components/shared/FilterChip";
import { TODO_STATUS_OPTIONS } from "@/constants/noteTypes";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEditorKeyboardHeight } from "@/hooks/useEditorKeyboardHeight";
import { useNoteEditorLayout } from "@/hooks/useNoteEditorLayout";
import { useRelatedNotes } from "@/hooks/useRelatedNotes";
import { useStyles } from "@/hooks/useStyles";
import { GitService } from "@/services/git/gitService";
import { NOTES_ROOT } from "@/services/notes/Notes";
import {
  type AttachmentType,
  copyPickedAttachmentToNote,
  deleteAttachment,
  inferAttachmentType,
} from "@/services/notes/attachmentStorage";
import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import { deriveNoteType } from "@/services/notes/noteTypeDerivation";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import { showToast } from "@/services/toast";
import { useTabStore } from "@/stores/tabStore";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AttachVideoModal from "./AttachVideoModal";
import { EditorSidePanelHost } from "./editor/EditorSidePanelHost";
import LexicalMarkdownEditor from "./editor/lexical/LexicalMarkdownEditor";
import { resolveOrCreateWikiLinkNoteId } from "./editor/lexical/wikilinks/wikiLinkUtils";
import {
  pickEditorDocument,
  pickEditorImage,
} from "./noteEditorFilePickers";

export default function NoteEditorView({
  note,
  isNew,
}: {
  note: Note;
  isNew?: boolean;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const styles = useStyles(createStyles);
  const colorScheme = useColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const id = note.id;
  const [isPinned, setIsPinned] = useState<boolean>(!!note.isPinned);
  const [title, setTitle] = useState<string>(note.title);
  const [noteType, setNoteType] = useState<Note["noteType"]>(note.noteType);
  const [todoStatus, setTodoStatus] = useState<Note["status"]>(
    note.noteType === "todo" ? (note.status ?? "open") : undefined,
  );
  const [lastCommand, setLastCommand] = useState<
    | { type: string; payload?: Record<string, unknown>; timestamp: number }
    | undefined
  >();
  const [editorMarkdown, setEditorMarkdown] = useState(note.content);
  const editorMarkdownRef = useRef(note.content);
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const keyboardHeight = useEditorKeyboardHeight();
  const [editorHostHeight, setEditorHostHeight] = useState<number | null>(null);
  const editorNativeHeight = Math.max(
    320,
    editorHostHeight ??
      windowHeight - safeAreaInsets.top - safeAreaInsets.bottom - 160,
  );

  const sendCommand = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      setLastCommand({ type, payload, timestamp: Date.now() });
    },
    [],
  );

  const handleMarkdownChange = useCallback((markdown: string) => {
    if (markdown === editorMarkdownRef.current) {
      return;
    }
    editorMarkdownRef.current = markdown;
    setEditorMarkdown(markdown);
  }, []);

  const getCurrentEditorMarkdown = useCallback(
    () => editorMarkdownRef.current,
    [],
  );

  const handleEditorHostLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setEditorHostHeight((current) =>
      Math.abs((current ?? 0) - nextHeight) > 1 ? nextHeight : current,
    );
  }, []);

  const { updateTabTitle, tabs, closeTab, openTab } = useTabStore();
  const tab = tabs.find((t) => t.noteId === id);

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
    [],
  );

  const isLeavingRef = useRef(false);
  const bypassNextBeforeRemoveRef = useRef(false);
  const isNewEntryRef = useRef(!!isNew);

  useEffect(() => {
    if (tab && title && tab.title !== title) {
      updateTabTitle(tab.id, title);
    }
  }, [tab, title, updateTabTitle]);

  const {
    activePanel,
    setActivePanel,
    toggleActivePanel,
    splitRatio,
    panResponder,
    isDesktop,
  } = useNoteEditorLayout(note);

  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [showRelatedNotes, setShowRelatedNotes] = useState(false);
  const {
    backlinks,
    outgoing,
    loading: relatedNotesLoading,
  } = useRelatedNotes(id);

  const [attachmentPath, setAttachmentPath] = useState<string | null>(
    note.attachment ?? null,
  );
  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(
    () => (note.attachment ? inferAttachmentType(note.attachment) : null),
  );
  const [isAttachmentVisible, setIsAttachmentVisible] = useState(
    () => !!note.attachment,
  );
  const [attachedVideo, setAttachedVideo] = useState<Note["attachedVideo"]>(
    note.attachedVideo,
  );
  const [resourceUrl, setResourceUrl] = useState<Note["resourceUrl"]>(
    note.resourceUrl,
  );
  const [isArticleVisible, setIsArticleVisible] = useState<boolean>(
    !!note.resourceUrl,
  );
  const [documentPositions, setDocumentPositions] = useState<
    Note["documentPositions"]
  >(note.documentPositions ?? null);
  const [isVideoVisible, setIsVideoVisible] = useState<boolean>(
    !!note.attachedVideo,
  );
  const [isShowVideoModalVisible, setIsShowVideoModalVisible] = useState(false);
  const { status, forceSave } = useAutoSave({
    ...note,
    currentContent: editorMarkdown,
    getCurrentContent: getCurrentEditorMarkdown,
    title,
    isPinned,
    noteType,
    status: noteType === "todo" ? (todoStatus ?? "open") : null,
    attachment: attachmentPath,
    attachedVideo,
    resourceUrl,
    documentPositions,
    initialNoteType: note.noteType,
    onPersisted: useCallback(() => {
      isNewEntryRef.current = false;
    }, []),
    isNew,
  });

  const saveAndFlushBeforeExit = useCallback(async () => {
    await forceSave();
    await flushGitAndToastOnFailure("note-exit");
  }, [flushGitAndToastOnFailure, forceSave]);

  const leaveEditor = useCallback(
    async (action?: { type: string; payload?: object }) => {
      if (isLeavingRef.current) {
        return;
      }

      isLeavingRef.current = true;
      try {
        await saveAndFlushBeforeExit();
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
    [navigation, router, saveAndFlushBeforeExit],
  );

  const handleBack = useCallback(async () => {
    if (tabs.length === 1 && tab && !tab.isPinned) {
      await saveAndFlushBeforeExit();
      bypassNextBeforeRemoveRef.current = true;
      closeTab(tab.id);
      router.replace("/");
    } else {
      await leaveEditor();
    }
  }, [tabs.length, tab, closeTab, leaveEditor, router, saveAndFlushBeforeExit]);

  const handleOpenWikiLink = useCallback(
    async (wikiLinkTitle: string) => {
      const linkedNoteId = await resolveOrCreateWikiLinkNoteId(wikiLinkTitle);
      if (linkedNoteId) {
        openTab(linkedNoteId, wikiLinkTitle);
        router.push(`/editor?id=${linkedNoteId}`);
      }
    },
    [openTab, router],
  );

  const handleApplyTemplate = useCallback(
    (markdown: string) => {
      editorMarkdownRef.current = markdown;
      setEditorMarkdown(markdown);
      setEditorInstanceKey((key) => key + 1);
      sendCommand("loadMarkdown", { markdown });
    },
    [sendCommand],
  );
  const loadedNoteRef = useRef<{ id: string; content: string } | null>(null);
  const latestDraftRef = useRef({
    title,
    isPinned,
    noteType,
    todoStatus,
  });
  latestDraftRef.current = {
    title,
    isPinned,
    noteType,
    todoStatus,
  };

  useEffect(() => {
    const derived = deriveNoteType(title);
    setNoteType((current) => (derived === "note" ? current : derived));
    setTodoStatus((current) =>
      (derived === "note" ? noteType : derived) === "todo"
        ? (current ?? "open")
        : undefined,
    );
  }, [noteType, title]);

  const buildCurrentNotePayload = useCallback(
    (overrides?: Partial<NoteSaveInput>): NoteSaveInput => {
      const draft = latestDraftRef.current;
      const content = editorMarkdownRef.current;
      const resolvedNoteType = overrides?.noteType ?? draft.noteType;
      const resolvedIsPinned = overrides?.isPinned ?? draft.isPinned;
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
        attachment:
          overrides?.attachment !== undefined
            ? overrides.attachment
            : attachmentPath,
        attachedVideo:
          overrides?.attachedVideo !== undefined
            ? overrides.attachedVideo
            : attachedVideo,
        resourceUrl:
          overrides?.resourceUrl !== undefined
            ? overrides.resourceUrl
            : resourceUrl,
        documentPositions:
          overrides?.documentPositions !== undefined
            ? overrides.documentPositions
            : documentPositions,
        ...overrides,
      };
    },
    [attachmentPath, attachedVideo, documentPositions, id, resourceUrl],
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

  useAppKeyboardShortcuts({
    onForceSave: forceSave,
  });

  useFocusEffect(
    useCallback(() => {
      setIsPinned(!!note.isPinned);
      setTitle(note.title);
      setNoteType(note.noteType);
      setTodoStatus(note.noteType === "todo" ? (note.status ?? "open") : null);
      setAttachmentPath(note.attachment ?? null);
      setAttachmentType(
        note.attachment ? inferAttachmentType(note.attachment) : null,
      );
      setIsAttachmentVisible(!!note.attachment);
      setAttachedVideo(note.attachedVideo);
      setResourceUrl(note.resourceUrl ?? null);
      setIsArticleVisible(!!note.resourceUrl);
      setDocumentPositions(note.documentPositions ?? null);
      setIsVideoVisible(!!note.attachedVideo);

      const loadedNote = loadedNoteRef.current;
      if (loadedNote?.id !== note.id || loadedNote.content !== note.content) {
        const shouldRemountEditor = loadedNote !== null;
        loadedNoteRef.current = { id: note.id, content: note.content };
        editorMarkdownRef.current = note.content;
        setEditorMarkdown(note.content);
        if (shouldRemountEditor) {
          setEditorInstanceKey((key) => key + 1);
        }
      }
    }, [
      note.attachment,
      note.attachedVideo,
      note.content,
      note.documentPositions,
      note.id,
      note.isPinned,
      note.noteType,
      note.resourceUrl,
      note.status,
      note.title,
    ]),
  );

  const handleTogglePin = useCallback(async () => {
    const nextIsPinned = !latestDraftRef.current.isPinned;
    await persistCurrentEntry({ isPinned: nextIsPinned });
    setIsPinned(nextIsPinned);
  }, [persistCurrentEntry]);

  const handleDeletePress = useCallback(async () => {
    await NoteService.deleteNote(id);
    await flushGitAndToastOnFailure(
      "delete",
      `Delete ${latestDraftRef.current.noteType}`,
    );
    bypassNextBeforeRemoveRef.current = true;
    router.back();
  }, [flushGitAndToastOnFailure, id, router]);

  const handleTextSelected = useCallback(
    (text: string) => {
      sendCommand("insertMarkdown", { markdown: `> ${text}` });
    },
    [sendCommand],
  );

  const handleAttachDocument = useCallback(async () => {
    const pickedDocument = await pickEditorDocument();
    if (pickedDocument.status === "cancelled") return;
    if (pickedDocument.status === "unsupported") {
      showToast("Unsupported file type. Please pick a PDF or ePub.");
      return;
    }

    try {
      const relativePath = await copyPickedAttachmentToNote(
        pickedDocument.uri,
        id,
      );
      setAttachmentPath(relativePath);
      setAttachmentType(pickedDocument.type);
      setDocumentPositions(null);
      setIsAttachmentVisible(true);
      setActivePanel("document");
      await persistCurrentEntry({
        attachment: relativePath,
        documentPositions: null,
      });
    } catch {
      showToast("Failed to attach document.");
    }
  }, [id, persistCurrentEntry, setActivePanel]);

  const handleHideAttachment = useCallback(() => {
    setIsAttachmentVisible(false);
  }, []);

  const handleShowAttachment = useCallback(() => {
    if (attachmentPath && attachmentType) {
      setIsAttachmentVisible(true);
      setActivePanel("document");
    }
  }, [attachmentPath, attachmentType, setActivePanel]);

  const handleDocumentPositionChange = useCallback(
    async (path: string, position: string) => {
      const nextPositions = {
        ...(documentPositions ?? {}),
        [path]: position,
      };
      setDocumentPositions(nextPositions);
      await persistCurrentEntry({ documentPositions: nextPositions });
    },
    [documentPositions, persistCurrentEntry],
  );

  const handleRemoveAttachment = useCallback(async () => {
    if (attachmentPath) {
      await deleteAttachment(attachmentPath).catch(() => null);
    }
    setAttachmentPath(null);
    setAttachmentType(null);
    setDocumentPositions(null);
    setIsAttachmentVisible(false);
    await persistCurrentEntry({ attachment: null, documentPositions: null });
  }, [attachmentPath, persistCurrentEntry]);

  const handleAttachVideo = useCallback(
    async (url: string) => {
      await persistCurrentEntry({ attachedVideo: url });
      setAttachedVideo(url);
      setIsVideoVisible(true);
      setActivePanel("video");
      setIsShowVideoModalVisible(false);
    },
    [persistCurrentEntry, setActivePanel],
  );

  const handleRemoveVideo = useCallback(async () => {
    await persistCurrentEntry({ attachedVideo: null });
    setAttachedVideo(null);
    setIsVideoVisible(false);
    setIsShowVideoModalVisible(false);
  }, [persistCurrentEntry]);

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

  const handleNavigateToNote = useCallback(
    async (noteId: string) => {
      await saveAndFlushBeforeExit();
      bypassNextBeforeRemoveRef.current = true;
      router.push(`/editor?id=${noteId}`);
    },
    [router, saveAndFlushBeforeExit],
  );

  const handleToolbarInsertImage = useCallback(async () => {
    const path = await pickEditorImage();
    if (path) {
      sendCommand("insertImage", { src: path, altText: "" });
    }
  }, [sendCommand]);

  const hasDocAttachment = attachmentPath !== null && attachmentType !== null;
  const showSplit =
    activePanel === "document"
      ? hasDocAttachment && isAttachmentVisible
      : activePanel === "article"
        ? !!resourceUrl && isArticleVisible
        : !!attachedVideo && isVideoVisible;
  const splitFlexDir =
    activePanel === "video" ? "column" : isDesktop ? "row" : "column";

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
          const nextNoteType = derived === "note" ? noteType : derived;
          setNoteType(nextNoteType);
          setTodoStatus((current) =>
            nextNoteType === "todo" ? (current ?? "open") : undefined,
          );
        }}
        onSubmitEditing={() => sendCommand("focusEditor")}
        onBack={() => {
          void handleBack();
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
          <EditorSidePanelHost
            activePanel={activePanel}
            articleUrl={resourceUrl ?? ""}
            attachmentPath={attachmentPath}
            attachmentType={attachmentType}
            dividerStyle={
              splitFlexDir === "row" ? styles.dividerV : styles.dividerH
            }
            noteId={id}
            onArticleDismiss={() => setIsArticleVisible(false)}
            onAttachmentDismiss={handleHideAttachment}
            onDocumentPositionChange={handleDocumentPositionChange}
            onTextSelected={handleTextSelected}
            onVideoDismiss={() => {
              void handleRemoveVideo();
            }}
            paneStyle={[
              styles.documentPane,
              splitFlexDir === "row"
                ? { width: `${splitRatio * 100}%` as unknown as number }
                : { height: `${splitRatio * 100}%` as unknown as number },
            ]}
            panHandlers={panResponder.panHandlers}
            videoUrl={attachedVideo ?? ""}
          />
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

            <View style={styles.editorHost} onLayout={handleEditorHostLayout}>
              <LexicalMarkdownEditor
                key={editorInstanceKey}
                hasAttachment={hasDocAttachment}
                markdown={editorMarkdown}
                onMarkdownChange={handleMarkdownChange}
                themeMode={colorScheme ?? "dark"}
                safeAreaInsets={safeAreaInsets}
                keyboardHeight={keyboardHeight}
                onAttachDocument={() => {
                  if (hasDocAttachment) {
                    handleShowAttachment();
                  } else {
                    void handleAttachDocument();
                  }
                }}
                onInsertImage={handleToolbarInsertImage}
                onInsertTemplateCommand={async () => {
                  setIsTemplateModalVisible(true);
                }}
                onOpenWikiLink={handleOpenWikiLink}
                onRemoveAttachment={() => void handleRemoveAttachment()}
                onShowVideoModal={() => setIsShowVideoModalVisible(true)}
                onToggleActivePanel={toggleActivePanel}
                onToggleArticle={() => {
                  setActivePanel("article");
                  setIsArticleVisible((visible) => !visible);
                }}
                onToggleRelatedNotes={() => setShowRelatedNotes((v) => !v)}
                command={lastCommand}
                dom={{
                  allowFileAccess: true,
                  allowFileAccessFromFileURLs: true,
                  allowingReadAccessToURL: NOTES_ROOT,
                  scrollEnabled: true,
                  containerStyle: [
                    styles.domEditor,
                    Platform.OS !== "web"
                      ? { height: editorNativeHeight }
                      : null,
                  ],
                  style: [
                    styles.domEditor,
                    Platform.OS !== "web"
                      ? { height: editorNativeHeight }
                      : null,
                  ],
                }}
              />
            </View>
          </View>

          {showRelatedNotes && (
            <View style={styles.relatedNotesContainer}>
              <NoteRelatedNotes
                backlinks={backlinks}
                outgoing={outgoing}
                loading={relatedNotesLoading}
                onNavigate={handleNavigateToNote}
              />
            </View>
          )}
        </View>
      </View>

      <TemplatePickerModal
        visible={isTemplateModalVisible}
        onApplyTemplate={handleApplyTemplate}
        onDismiss={() => setIsTemplateModalVisible(false)}
      />
      <AttachVideoModal
        visible={isShowVideoModalVisible}
        currentVideo={attachedVideo}
        onDismiss={() => setIsShowVideoModalVisible(false)}
        onSave={(url) => {
          void handleAttachVideo(url);
        }}
        onRemove={() => {
          void handleRemoveVideo();
        }}
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
      minHeight: 0,
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
      minHeight: 0,
      overflow: "hidden",
    },
    content: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
      gap: 8,
    },
    editorHost: {
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
    },
    domEditor: {
      flex: 1,
      width: "100%",
      height: "100%",
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
    relatedNotesContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      maxHeight: 280,
    },
  });
}
