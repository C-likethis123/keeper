import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/themeStore";
import { Stack } from "expo-router";
import { useEffect, useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from "react-native";
import { ThemeProvider } from "@react-navigation/native";
import { createLightTheme, createDarkTheme } from "@/constants/themes";

export default function RootLayout() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s.isHydrated);
  const themeStoreHydrated = useThemeStore((s) => s.isHydrated);
  const themeMode = useThemeStore((s) => s.themeMode);
  const hydrateThemeStore = useThemeStore((s) => s.hydrate);
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    hydrate();
    hydrateThemeStore();
  }, []);

  // Determine which theme to use
  const effectiveTheme = useMemo(() => {
    const shouldUseDark =
      themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    return shouldUseDark ? createDarkTheme() : createLightTheme();
  }, [themeMode, systemColorScheme]);

  if (!hydrated || !themeStoreHydrated) {
    // Splash screen while hydrating
    return (
      <View style={styles.splash}>
        <Text style={styles.title}>My App</Text>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ThemeProvider value={effectiveTheme}>
      <Stack />
    </ThemeProvider>
  );
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
