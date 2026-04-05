import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export default function EmptyState({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  const styles = useStyles(createStyles);
  const showAction = actionLabel && onActionPress;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {showAction && (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={onActionPress}
          >
            <Ionicons name="gear" size={18} style={styles.buttonIcon} />
            <Text style={styles.buttonLabel}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },

    content: {
      alignItems: "center",
      maxWidth: 420,
    },

    title: {
      marginTop: 16,
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },

    subtitle: {
      marginTop: 8,
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },

    button: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
    },
    buttonPressed: {
      opacity: 0.8,
    },

    buttonIcon: {
      marginRight: 8,
      color: theme.colors.primaryContrast,
    },

    buttonLabel: {
      color: theme.colors.primaryContrast,
      fontWeight: "600",
      fontSize: 15,
    },
  });
}
