import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";

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

export function SaveIndicator({ status }: Props) {
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const iconName = iconNameMap[status];
  
  // Use theme-aware colors with better contrast
  const iconColor = useMemo(() => {
    switch (status) {
      case "saving":
        return theme.dark ? "#fbbf24" : "#f59e0b"; // Lighter amber for dark mode
      case "saved":
        return theme.dark ? "#4ade80" : "#16a34a"; // Lighter green for dark mode
      case "idle":
        return theme.colors.text + "80"; // Text color with 50% opacity
      default:
        return theme.colors.text;
    }
  }, [status, theme]);

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

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
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
      color: theme.colors.text, // Use theme text color for better contrast
    },
    subtitle: {
      fontSize: 11,
      color: theme.colors.text + "80", // Text color with 50% opacity
    },
  });
}
