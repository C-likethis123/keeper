import NoteEditorHeader from "@/components/NoteEditorHeader";
import NoteRelatedNotes from "@/components/moc/NoteRelatedNotes";
import TemplatePickerModal from "@/components/TemplatePickerModal";
import { FilterChip } from "@/components/shared/FilterChip";
import { TODO_STATUS_OPTIONS } from "@/constants/noteTypes";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAutoSave } from "@/hooks/useAutoSave";
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
import { useEditorState } from "@/stores/editorStore";
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
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AttachVideoModal from "./AttachVideoModal";
import DomEditor from "./editor/DomEditor";
import { DocumentPanel } from "./editor/document/DocumentPanel";
import VideoSplitPanel from "./editor/video/VideoSplitPanel";
import { resolveOrCreateWikiLinkNoteId } from "./editor/wikilinks/wikiLinkUtils";

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
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const sendCommand = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      setLastCommand({ type, payload, timestamp: Date.now() });
    },
    [],
  );

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

  const loadMarkdown = useEditorState((s) => s.loadMarkdown);
  const setCurrentMarkdown = useEditorState((s) => s.setCurrentMarkdown);
  const handleApplyTemplate = useCallback(
    (markdown: string) => {
      setEditorMarkdown(markdown);
      setEditorInstanceKey((key) => key + 1);
      setCurrentMarkdown(markdown);
      sendCommand("loadMarkdown", { markdown });
    },
    [sendCommand, setCurrentMarkdown],
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
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
      const content = useEditorState.getState().getContent();
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
        loadedNoteRef.current = { id: note.id, content: note.content };
        setEditorMarkdown(note.content);
        loadMarkdown(note.content);
      }
    }, [
      loadMarkdown,
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
    let pickedUri: string | null = null;
    let pickedName: string | null = null;

    if (Platform.OS === "web") {
      // Tauri desktop: use @tauri-apps/plugin-dialog
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Documents", extensions: ["pdf", "epub"] }],
      });
      if (!selected) return;
      pickedUri = Array.isArray(selected) ? selected[0] : selected;
      pickedName = pickedUri?.split(/[\\/]/).pop() ?? pickedUri;
    } else {
      // Mobile: use expo-document-picker
      const documentPickerModule = await import("expo-document-picker");
      const result = await documentPickerModule.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      pickedUri = asset.uri;
      pickedName = asset.name ?? asset.uri;
    }

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
      setDocumentPositions(null);
      setIsAttachmentVisible(true);
      await persistCurrentEntry({
        attachment: relativePath,
        documentPositions: null,
      });
    } catch {
      showToast("Failed to attach document.");
    }
  }, [id, persistCurrentEntry]);

  const handleHideAttachment = useCallback(() => {
    setIsAttachmentVisible(false);
  }, []);

  const handleShowAttachment = useCallback(() => {
    if (attachmentPath && attachmentType) {
      setIsAttachmentVisible(true);
    }
  }, [attachmentPath, attachmentType]);

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
    let path: string | null = null;
    if (Platform.OS === "web") {
      const [dialogModule, imageStorageModule] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@/services/notes/imageStorage.web"),
      ]);
      const selected = await dialogModule.open({
        title: "Select Image",
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: [
              "png",
              "jpg",
              "jpeg",
              "gif",
              "webp",
              "bmp",
              "svg",
              "ico",
            ],
          },
        ],
      });
      if (selected === null || Array.isArray(selected)) return;
      path = await imageStorageModule.copyPickedImageToNotes(selected);
    } else {
      const [documentPickerModule, imageStorageModule] = await Promise.all([
        import("expo-document-picker"),
        import("@/services/notes/imageStorage"),
      ]);
      const result = await documentPickerModule.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      path = await imageStorageModule.copyPickedImageToNotes(
        result.assets[0].uri,
      );
    }
    if (path) {
      const imageMarkdown = `![](${path})`;
      const currentMarkdown = useEditorState.getState().getContent();
      setCurrentMarkdown(
        currentMarkdown.trim().length > 0
          ? `${currentMarkdown}\n\n${imageMarkdown}`
          : imageMarkdown,
      );
      sendCommand("insertImage", { src: path, altText: "" });
      await persistCurrentEntry();
    }
  }, [persistCurrentEntry, sendCommand, setCurrentMarkdown]);

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
          <>
            <View
              style={[
                styles.documentPane,
                splitFlexDir === "row"
                  ? { width: `${splitRatio * 100}%` as unknown as number }
                  : { height: `${splitRatio * 100}%` as unknown as number },
              ]}
            >
              {activePanel === "document" ? (
                <DocumentPanel
                  noteId={id}
                  attachmentPath={attachmentPath as string}
                  attachmentType={attachmentType as AttachmentType}
                  onTextSelected={handleTextSelected}
                  onDocumentPositionChange={handleDocumentPositionChange}
                  onDismiss={handleHideAttachment}
                />
              ) : activePanel === "article" ? (
                <DocumentPanel
                  variant="article"
                  url={resourceUrl ?? ""}
                  onDismiss={() => setIsArticleVisible(false)}
                />
              ) : (
                <VideoSplitPanel
                  url={attachedVideo ?? ""}
                  onDismiss={() => {
                    void handleRemoveVideo();
                  }}
                />
              )}
            </View>
            <View
              style={splitFlexDir === "row" ? styles.dividerV : styles.dividerH}
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

            <DomEditor
              key={editorInstanceKey}
              hasAttachment={hasDocAttachment}
              markdown={editorMarkdown}
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
                style: { flex: 1 },
              }}
            />
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
    relatedNotesContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      maxHeight: 280,
    },
  });
}
