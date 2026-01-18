import { useSettingsStore } from "@/stores/settings";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function RootLayout() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s.isHydrated);
  useEffect(() => {
    hydrate();
  }, []);

  if (!hydrated) {
    // Splash screen while hydrating
    return (
      <View style={styles.splash}>
        <Text style={styles.title}>My App</Text>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <Stack />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563eb",
  },
});
