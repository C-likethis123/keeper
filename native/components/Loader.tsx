import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";

export default function Loader() {
  const theme = useExtendedTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
  });
}

