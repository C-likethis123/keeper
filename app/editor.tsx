import Loader from "@/components/Loader";
import { SaveIndicator } from "@/components/SaveIndicator";
import { HybridEditor } from "@/components/editor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { BlockType } from "@/components/editor/core/BlockNode";
import { EditorProvider } from "@/contexts/EditorContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useLoadNote } from "@/hooks/useLoadNote";
import { useNoteStore } from "@/stores/notes/noteService";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function NoteEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { filePath } = params;
  const theme = useExtendedTheme();

  const { loadNote } = useNoteStore();
  const [focusedBlockInfo, setFocusedBlockInfo] = useState<{
    blockType: BlockType | null;
    blockIndex: number | null;
    listLevel: number;
    onIndent: () => void;
    onOutdent: () => void;
  }>({
    blockType: null,
    blockIndex: null,
    listLevel: 0,
    onIndent: () => { },
    onOutdent: () => { },
  });

  // Load existing note if editing
  const { isLoading, error, note, setNote } = useLoadNote(filePath as string);

  const togglePin = () => {
    setNote((prev) => {
      if (!prev) return null;
      return { ...prev, isPinned: !prev.isPinned };
    });
  };

  const { status, saveNow } = useAutoSave({
    filePath: filePath as string,
    title: note?.title || "",
    content: note?.content || "",
    isPinned: note?.isPinned || false,
  });

  const handleContentChange = (markdown: string) => {
    setNote((prev) => {
      if (!prev) return null;
      return { ...prev, content: markdown };
    });
  };

  const styles = useMemo(() => createStyles(theme), [theme]);


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Editor",
          headerLeft: () => (
            <TouchableOpacity
              onPress={async () => {
                await saveNow();
                router.back();
              }}
              style={{ marginLeft: 8, marginRight: 8 }}
            >
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={togglePin} style={{ marginRight: 8 }}>
              <MaterialIcons
                name="push-pin"
                size={24}
                color={note?.isPinned ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
          ),
          headerTitle: () => <SaveIndicator status={status} />,
        }}
      />

      <View style={styles.container}>
        {isLoading ? <Loader /> :
          <>
            <TextInput
              style={styles.titleInput}
              value={note?.title || ""}
              onChangeText={(text) => setNote((prev) => {
                if (!prev) return null;
                return { ...prev, title: text };
              })}
              placeholder="Title"
              placeholderTextColor={theme.custom.editor.placeholder}
              autoFocus={!note}
            />

            <EditorProvider>
              <EditorToolbar
                blockType={focusedBlockInfo.blockType}
                blockIndex={focusedBlockInfo.blockIndex}
                listLevel={focusedBlockInfo.listLevel}
                onIndent={focusedBlockInfo.onIndent}
                onOutdent={focusedBlockInfo.onOutdent}
              />

              <HybridEditor
                initialContent={note?.content || ""}
                onChanged={handleContentChange}
                onFocusedBlockChange={setFocusedBlockInfo}
              />
            </EditorProvider>
          </>}
      </View>
    </KeyboardAvoidingView>
  );
}

// Styles are created dynamically based on theme
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
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
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 8,
    },
  });
}
