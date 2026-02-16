import { SaveIndicator } from "@/components/SaveIndicator";
import { HybridEditor } from "@/components/editor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { BlockType } from "@/components/editor/core/BlockNode";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { Note } from "@/services/notes/types";
import { useNoteStore } from "@/stores/notes/noteService";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
  const [existingNote, setExistingNote] = useState<Note | null>(null);
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
    onIndent: () => {},
    onOutdent: () => {},
  });

  // Load existing note if editing
  useEffect(() => {
    if (filePath) {
      loadNote(filePath as string).then((note) => {
        if (note) {
          setExistingNote(note);
        }
      });
    }
  }, [filePath, loadNote]);

  const togglePin = () => {
    setExistingNote((prev) => {
      if (!prev) return null;
      return { ...prev, isPinned: !prev.isPinned };
    });
  };

  const { status } = useAutoSave({
    filePath: filePath as string,
    title: existingNote?.title || "",
    content: existingNote?.content || "",
    isPinned: existingNote?.isPinned || false,
  });

  const handleContentChange = (markdown: string) => {
    setExistingNote((prev) => {
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
              onPress={() => router.back()}
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
                color={existingNote?.isPinned ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
          ),
          headerTitle: () => <SaveIndicator status={status} />,
        }}
      />

      <View style={styles.container}>
        <TextInput
          style={styles.titleInput}
          value={existingNote?.title || ""}
          onChangeText={(text) => setExistingNote((prev) => {
            if (!prev) return null;
            return { ...prev, title: text };
          })}
          placeholder="Title"
          placeholderTextColor={theme.custom.editor.placeholder}
          autoFocus={!existingNote}
        />

        <EditorToolbar
          blockType={focusedBlockInfo.blockType}
          blockIndex={focusedBlockInfo.blockIndex}
          listLevel={focusedBlockInfo.listLevel}
          onIndent={focusedBlockInfo.onIndent}
          onOutdent={focusedBlockInfo.onOutdent}
        />

        <View style={styles.divider} />

        <HybridEditor
          initialContent={existingNote?.content || ""}
          onChanged={handleContentChange}
          autofocus={!existingNote}
          onFocusedBlockChange={setFocusedBlockInfo}
        />
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
