import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { router } from 'expo-router';
import NoteGrid from "@/components/NoteGrid";
import { useSettings } from "@/services/settings/useSettings";
import { MaterialIcons } from "@expo/vector-icons";
import { NoteService } from "@/services/notes/noteService";
import { NoteMetadata } from "@/services/notes/types";
export default function Index() {
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allMetadata, setAllMetadata] = useState<NoteMetadata[]>([]);

  const settings = useSettings();

  useEffect(() => {
    const fetchNotes = async () => {
      const notes = await NoteService.instance.scanNotes(settings.folder!);
      console.log("notes:", notes);
      setAllMetadata(notes);
    };
    fetchNotes();
  }, []);

  if (loadingMetadata) {
    return <ActivityIndicator style={styles.center} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
        <TouchableOpacity onPress={() => setError('err')}>
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!settings.hasFolder) {
    return (
      <EmptyState
        title={'No folder configured'}
        subtitle={'Configure a folder in settings'}
        actionLabel={'Configure folder'}
        onActionPress={() => router.push('/settings')}
      />
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
      <NoteGrid notes={allMetadata} />
      <TouchableOpacity activeOpacity={0.8} style={styles.fab} onPress={() => router.push('/editor')}><MaterialIcons name="add" size={28} color="#fff" /></TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  retry: {
    marginTop: 12,
    color: '#2563eb', // blue-600
    fontWeight: '600',
  },

  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4, // Android
    shadowColor: '#000', // iOS
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
