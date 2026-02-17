// Import Buffer polyfill for isomorphic-git
import { Buffer } from 'buffer';
global.Buffer = Buffer;
globalThis.Buffer = Buffer;

// Import WDYR first, before React imports (development only)
require('../wdyr');


import { ToastOverlay } from "@/components/Toast";
import { createDarkTheme } from "@/constants/themes/darkTheme";
import { createLightTheme } from "@/constants/themes/lightTheme";
import { GitInitializationService } from "@/services/git/gitInitializationService";
import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useThemeStore } from "@/stores/themeStore";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

export default function RootLayout() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const hydrateThemeStore = useThemeStore((s) => s.hydrate);
  const systemColorScheme = useColorScheme();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      hydrateThemeStore(),
      useNotesMetaStore.getState().hydrate(),
      (async () => {
        try {
          const result = await GitInitializationService.instance.initialize();
          if (result.success) {
            console.log('[App] Git initialization succeeded:', {
              wasCloned: result.wasCloned,
              branch: result.status?.currentBranch,
            });
          } else {
            console.error('[App] Git initialization failed:', result.error);
          }
        } catch (error) {
          console.error('[App] Git initialization error:', error);
        }
      })()
    ]).then(() => setIsHydrated(true));
  }, [hydrateThemeStore]);

  // Determine which theme to use
  const effectiveTheme = useMemo(() => {
    const shouldUseDark =
      themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    return shouldUseDark ? createDarkTheme() : createLightTheme();
  }, [themeMode, systemColorScheme]);

  if (!isHydrated) {
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
      <ToastOverlay />
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
