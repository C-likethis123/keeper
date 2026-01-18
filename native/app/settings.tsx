import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';

import { useSettings } from '@/services/settings/useSettings';
import { getPathBasename } from '@/utils/platform_utils';
import { FolderPicker } from '@/components/document_picker';
import { InfoCard } from '@/components/IconCard';
import { useToastStore } from '@/stores/toastStore';

export default function Settings() {
  const { colors } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const [folder, setFolder] = useState<string | null>(null);
  const settings = useSettings();

  const onFolderChanged = useCallback(async (newFolder?: string | null) => {
    if (newFolder) {
      await settings.setFolder(newFolder);
      setFolder(newFolder);

      showToast(`Set folder: ${getPathBasename(newFolder)}`);
    } else {
      await settings.clearFolder();
      setFolder(null);
    }
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section header */}
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>
        Notes Folder
      </Text>

      <Text style={[styles.sectionDescription, { color: colors.text + '99' }]}>
        Select a folder to read and save notes.
      </Text>

      {/* Folder picker */}
      <FolderPicker
        folderPath={folder}
        emptyStateTitle="No folder configured"
        emptyStateSubtitle="Select a folder to start loading notes"
        onFolderChanged={onFolderChanged}
      />

      {/* Mobile notice */}
      {Platform.OS !== 'web' && (
        <InfoCard
          icon="info"
          style={{ marginTop: 32 }}
          backgroundColor={colors.notification + '22'}
          textColor={colors.text}
        >
          On mobile devices, folder access may be limited to specific locations.
        </InfoCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: 14,
      marginBottom: 16,
    },
  });
  