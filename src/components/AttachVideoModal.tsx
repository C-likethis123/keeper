import { parseEmbeddedVideoUrl } from "@/components/editor/video/videoUtils";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AttachVideoModal({
  visible,
  currentVideo,
  onDismiss,
  onSave,
  onRemove,
}: {
  visible: boolean;
  currentVideo?: string | null;
  onDismiss: () => void;
  onSave: (url: string) => void;
  onRemove: () => void;
}) {
  const styles = useStyles(createStyles);
  const [value, setValue] = useState(currentVideo ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a YouTube URL");
      return;
    }
    const parsed = parseEmbeddedVideoUrl(trimmed);
    if (!parsed) {
      setError("Not a valid YouTube URL");
      return;
    }
    setError(null);
    onSave(trimmed);
  };

  const handleRemove = () => {
    setValue("");
    setError(null);
    onRemove();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Attach Video</Text>
            <Pressable onPress={onDismiss}>
              <FontAwesome name="close" size={22} style={styles.closeIcon} />
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={styles.placeholder.color}
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onDismiss}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
          {currentVideo ? (
            <Pressable style={styles.removeButton} onPress={handleRemove}>
              <Text style={styles.removeButtonText}>Remove video</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: ExtendedTheme) {
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      justifyContent: "center",
      padding: 20,
    },
    modalCard: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeIcon: {
      color: theme.colors.text,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
    },
    placeholder: {
      color: theme.colors.textMuted,
    },
    errorText: {
      fontSize: 13,
      color: "#e03e3e",
    },
    buttonRow: {
      flexDirection: "row",
      gap: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: "#007AFF",
      alignItems: "center",
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#fff",
    },
    removeButton: {
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#e03e3e",
      alignItems: "center",
    },
    removeButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#e03e3e",
    },
  });
}
