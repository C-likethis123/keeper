import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import EmptyState from "@/components/EmptyState";
import { router } from 'expo-router';
import NoteGrid from "@/components/NoteGrid";
import { MaterialIcons } from "@expo/vector-icons";
import { NoteService } from "@/services/notes/noteService";
import { Note } from "@/services/notes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useToastStore } from "@/stores/toastStore";
import {
  NotesIndexService,
  type NoteIndexItem,
} from "@/services/notes/notesIndex";
export default function Index() {
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const theme = useExtendedTheme();
  const { showToast } = useToastStore();

  const fetchNotes = useCallback(async () => {
    setLoadingMetadata(true);
    setError(null);

    try {
      // Fetch pinned and unpinned notes from DynamoDB index.
      const [pinnedResult, unpinnedResult] = await Promise.all([
        NotesIndexService.instance.listByStatus("PINNED", 50),
        NotesIndexService.instance.listByStatus("UNPINNED", 50),
      ]);

      const toNote = (item: NoteIndexItem): Note => ({
        title:
          item.noteId.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled",
        // We treat the index summary as the card preview content.
        content: item.summary,
        filePath: item.noteId,
        lastUpdated: item.updatedAt,
        isPinned: item.status === "PINNED",
      });

      const combinedNotes: Note[] = [
        ...pinnedResult.items.map(toNote),
        ...unpinnedResult.items.map(toNote),
      ];

      setNotes(combinedNotes);
    } catch (e) {
      console.warn("Failed to load notes from index:", e);
      setError("Failed to load notes");
    } finally {
      setLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleDeleteNote = useCallback(async (note: Note) => {
    try {
      const success = await NoteService.instance.deleteNote(note.filePath);
      if (success) {
        setNotes((prevNotes) => prevNotes.filter((n) => n.filePath !== note.filePath));
        showToast(`Deleted "${note.title}"`);
      } else {
        showToast('Failed to delete note');
      }
    } catch (e) {
      console.warn('Failed to delete note:', e);
      showToast('Failed to delete note');
    }
  }, [showToast]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (loadingMetadata) {
    return <ActivityIndicator style={styles.center} />;
  }


  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.text }}>{error}</Text>
        <TouchableOpacity onPress={fetchNotes}>
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <NoteGrid notes={notes} onDelete={handleDeleteNote} />
      <TouchableOpacity activeOpacity={0.8} style={styles.fab} onPress={() => router.push('/editor')}><MaterialIcons name="add" size={28} color={theme.colors.card} /></TouchableOpacity>
    </View>
  );
}


// Styles are created dynamically based on theme
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },

    retry: {
      marginTop: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },

    fab: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4, // Android
      shadowColor: '#000', // iOS
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
  });
}
