import type { NoteType } from "@/services/notes/types";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { IconButton } from "@/components/shared/IconButton";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeQuickComposer({
  onPress,
}: {
  onPress: (props?: { noteType?: NoteType; title?: string }) => void;
}) {
  const styles = useStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a note"
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.primaryActionPressed,
          ]}
          onPress={onPress}
        >
          <Text style={[styles.placeholder]}>Take a note...</Text>
        </Pressable>
        <View style={styles.actions}>
          <IconButton
            label="Create todo"
            name="check-square-o"
            variant="flat"
            onPress={() => onPress({ noteType: "todo", title: "TODO:" })}
          />
          <IconButton
            label="Create journal"
            name="pencil"
            variant="flat"
            onPress={() => onPress({ noteType: "journal", title: "Journal: " })}
          />
          <IconButton
            label="Create resource"
            name="bookmark-o"
            variant="flat"
            onPress={() => onPress({ noteType: "resource", title: "Source: " })}
          />
          <IconButton
            label="Create drawing"
            name="paint-brush"
            variant="flat"
            testID="home-quick-composer-brush"
            onPress={() => onPress({ noteType: "drawing", title: "Drawing: " })}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    wrapper: {
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 8,
    },
    card: {
      maxWidth: 640,
      width: "100%",
      alignSelf: "center",
      minHeight: 60,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    primaryAction: {
      flex: 1,
    },
    primaryActionPressed: {
      opacity: 0.85,
    },
    placeholder: {
      flex: 1,
      fontSize: 20,
      color: theme.colors.textMuted,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginLeft: 16,
    },
    actionButtonWrapper: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      paddingVertical: 2,
      color: theme.colors.textMuted,
    },
    tooltip: {
      position: "absolute",
      bottom: "100%",
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.text,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      zIndex: 10,
    },
    tooltipText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.card,
    },
  });
}
