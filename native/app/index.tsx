import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import EmptyState from "@/components/EmptyState";
import { router } from 'expo-router';
import NoteGrid from "@/components/NoteGrid";
import { useSettings } from "@/services/settings/useSettings";
export default function Index() {
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allMetadata, setAllMetadata] = useState<{ title: string, id: string }[]>([]);

  const settings = useSettings();

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

  if (!allMetadata.length) {
    return (
      <EmptyState
        title={
          settings.hasFolder ? 'No notes found' : 'No folder configured'
        }
        subtitle={
          settings.hasFolder
            ? 'Create a note to get started'
            : 'Configure a folder in settings'
        }
        actionLabel={
          !settings.hasFolder
            ? 'Configure folder'
            : undefined
        }
        onActionPress={
          !settings.hasFolder
            ? () => router.push('/settings')
            : undefined
        }
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

  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 28,
  },
});
