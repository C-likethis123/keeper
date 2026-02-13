import { StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { router } from 'expo-router';
import NoteGrid from "@/components/NoteGrid";
import { MaterialIcons } from "@expo/vector-icons";
import { NoteService } from "@/services/notes/noteService";
import { Note } from "@/services/notes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useToastStore } from "@/stores/toastStore";
import ErrorScreen from "@/components/ErrorScreen";
import Loader from "@/components/Loader";
import {
  NotesIndexService,
  type NoteIndexItem,
} from "@/services/notes/notesIndex";
export default function Index() {
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const theme = useExtendedTheme();
  const { showToast } = useToastStore();

  const fetchNotes = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingMetadata(true);
    }
    setError(null);

    try {
      // Fetch pinned and unpinned notes from DynamoDB index.
      const [pinnedResult, unpinnedResult] = await Promise.all([
        NotesIndexService.instance.listByStatus("PINNED", 50),
        NotesIndexService.instance.listByStatus("UNPINNED", 50),
      ]);

      const toNote = (item: NoteIndexItem): Note => ({
        // Use title from index if available, otherwise extract from summary or filename
        title: item.title || 
          (item.summary.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim()) ||
          item.noteId.split("/").pop()?.replace(/\.md$/, "") || 
          "Untitled",
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
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoadingMetadata(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchNotes(true);
  }, [fetchNotes]);

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
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorScreen
        errorMessage={error}
        onRetry={() => fetchNotes(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <NoteGrid
        notes={notes}
        onDelete={handleDeleteNote}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
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
