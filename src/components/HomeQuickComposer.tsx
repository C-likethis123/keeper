import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteType } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function QuickActionButton({
  label,
  icon,
  onPress,
  testID,
  iconColor,
  styles,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress?: () => void;
  testID?: string;
  iconColor: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <View style={styles.actionButtonWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        hitSlop={8}
        onPress={onPress}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={styles.iconButton}
      >
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </Pressable>
      {isHovered ? (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text numberOfLines={1} style={styles.tooltipText}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function HomeQuickComposer({
  onPress,
}: {
  onPress: (props?: { noteType?: NoteType; title?: string }) => void;
}) {
  const theme = useExtendedTheme();
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
          <QuickActionButton
            label="Create todo"
            icon="check-box"
            onPress={() => onPress({ noteType: "todo", title: "TODO:" })}
            iconColor={theme.colors.textMuted}
            styles={styles}
          />
          <QuickActionButton
            label="Create journal"
            icon="menu-book"
            onPress={() => onPress({ noteType: "journal", title: "Journal: " })}
            iconColor={theme.colors.textMuted}
            styles={styles}
          />
          <QuickActionButton
            label="Create resource"
            icon="bookmarks"
            onPress={() => onPress({ noteType: "resource", title: "Source: " })}
            iconColor={theme.colors.textMuted}
            styles={styles}
          />
          <QuickActionButton
            label="Create drawing"
            icon="brush"
            testID="home-quick-composer-brush"
            iconColor={theme.colors.textMuted}
            styles={styles}
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
