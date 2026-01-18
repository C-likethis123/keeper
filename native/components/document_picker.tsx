import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import * as FileSystem from "expo-file-system";
import EmptyState from "@/components/EmptyState";
import { getPathBasename } from "@/utils/platform_utils";

/**
 * Sandbox notes root
 * Always ends with /
 */
const NOTES_ROOT = FileSystem.Paths.cache.uri + "notes/";

async function ensureNotesRoot() {
  try {
    const info = await FileSystem.getInfoAsync(NOTES_ROOT);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(NOTES_ROOT, {
        intermediates: true,
      });
    }
  } catch (e) {
    console.warn("Failed to ensure notes root:", e);
  }
}

async function listSubfolders(dirUri: string): Promise<string[]> {
  try {
    const entries = await FileSystem.readDirectoryAsync(dirUri);
    const folders: string[] = [];

    for (const name of entries) {
      const info = await FileSystem.getInfoAsync(dirUri + name);
      if (info.isDirectory) {
        folders.push(name);
      }
    }

    return folders;
  } catch (e) {
    console.warn("Failed to list subfolders:", e);
    return [];
  }
}

interface FolderPickerProps {
  folderPath?: string | null;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  selectButtonLabel?: string;
  changeButtonLabel?: string;
  removeButtonLabel?: string;
  onFolderChanged?: (folder: string | null) => void;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  folderPath,
  emptyStateTitle = "No folder configured",
  emptyStateSubtitle = "Select a folder to get started",
  selectButtonLabel = "Select Folder",
  changeButtonLabel = "Change Folder",
  removeButtonLabel = "Remove",
  onFolderChanged,
}) => {
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const refreshFolders = async () => {
    await ensureNotesRoot();
    onFolderChanged?.(NOTES_ROOT);
    const names = await listSubfolders(NOTES_ROOT);
    setSubfolders(names);
  };

  useEffect(() => {
    refreshFolders();
  }, []);

  /**
   * For now: selecting the workspace root itself
   */
  const selectRootFolder = () => {
    onFolderChanged?.(NOTES_ROOT);
    setModalVisible(false);
  };

  const pickFolderByName = (name: string) => {
    const uri = `${NOTES_ROOT}${name}/`;
    onFolderChanged?.(uri);
    setModalVisible(false);
  };

  const clearFolder = () => {
    if (!folderPath) return;

    Alert.alert(
      "Remove Folder",
      `Remove "${getPathBasename(folderPath)}" from settings?\nThis will not delete files.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onFolderChanged?.(null),
        },
      ]
    );
  };

  if (!folderPath) {
    return (
      <EmptyState
        title={emptyStateTitle}
        subtitle={emptyStateSubtitle}
        actionLabel={selectButtonLabel}
        onActionPress={() => setModalVisible(true)}
      />
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.folderName}>{getPathBasename(folderPath)}</Text>
      <Text style={styles.folderPath}>{folderPath}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.outlinedButton}
          onPress={() => setModalVisible(true)}
        >
          <Text>{changeButtonLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.textButton} onPress={clearFolder}>
          <Text style={{ color: "red" }}>{removeButtonLabel}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Folder</Text>

            {/* Root workspace option */}
            <Pressable style={styles.folderItem} onPress={selectRootFolder}>
              <Text style={{ fontWeight: "600" }}>notes/ (workspace root)</Text>
            </Pressable>

            <FlatList
              data={subfolders}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.folderItem}
                  onPress={() => pickFolderByName(item)}
                >
                  <Text>{item}</Text>
                </Pressable>
              )}
            />

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCancel}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#2563eb",
    marginVertical: 8,
  },
  folderName: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 4,
  },
  folderPath: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  outlinedButton: {
    marginRight: 8,
  },
  textButton: {},
  modalBackground: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    width: "80%",
    maxHeight: "60%",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 12,
  },
  folderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalCancel: {
    marginTop: 12,
    alignItems: "center",
  },
});
