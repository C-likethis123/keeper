import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useNoteStore } from "@/stores/notes/noteService";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Note } from "@/services/notes/types";
import { SaveIndicator } from "@/components/SaveIndicator";

export default function NoteEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { filePath } = params;

  const { loadNote } = useNoteStore();
  const [existingNote, setExistingNote] = useState<Note | null>(null);
  // Load existing note if editing
  useEffect(() => {
    if (filePath) {
      loadNote(filePath as string).then((note) => setExistingNote(note));
    }
  }, []);

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
              <MaterialIcons name="arrow-back" size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={togglePin} style={{ marginRight: 8 }}>
              <MaterialIcons
                name="push-pin"
                size={24}
                color={existingNote?.isPinned ? "#2563eb" : "#555"}
              />
            </TouchableOpacity>
          ),
          headerTitle: () => <SaveIndicator status={status} />,
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <TextInput
          style={styles.titleInput}
          value={existingNote?.title || ""}
          onChangeText={(text) => setExistingNote((prev) => {
            if (!prev) return null;
            return { ...prev, title: text };
          })}
          placeholder="Title"
          autoFocus={!existingNote}
        />

        <View style={styles.divider} />

        <TextInput
          style={styles.contentInput}
          value={existingNote?.content || ""}
          onChangeText={(text) => setExistingNote((prev) => {
            if (!prev) return null;
            return { ...prev, content: text };
          })}
          placeholder="Write your note..."
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 8,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 300,
    padding: 8,
  },
});
