import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type SaveStatus = "idle" | "saving" | "saved";

type Props = {
  status: SaveStatus;
};

const titleMap = {
    "saving": "Saving…",
    "saved": "Saved",
    "idle": "",
}

const iconNameMap = {
    "saving": "sync",
    "saved": "check-circle",
    "idle": "edit",
} as const

const iconColorMap = {
    "saving": "#f59e0b",
    "saved": "#16a34a",
    "idle": "#6b7280",
}

export function SaveIndicator({ status }: Props) {
  const iconName = iconNameMap[status];
  const iconColor = iconColorMap[status];

  return (
    <View style={styles.container}>
      <MaterialIcons name={iconName} size={16} color={iconColor} />
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {titleMap[status]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
  },
  textContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
  },
});
