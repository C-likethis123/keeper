// Import Buffer polyfill for isomorphic-git
import { Buffer } from 'buffer';
global.Buffer = Buffer;
globalThis.Buffer = Buffer;

// Import WDYR first, before React imports (development only)
require('../wdyr');


import { ToastOverlay } from "@/components/Toast";
import { createDarkTheme, createLightTheme } from "@/constants/themes";
import { GitInitializationService } from "@/services/git/gitInitializationService";
import { NoteService } from "@/services/notes/noteService";
import { useThemeStore } from "@/stores/themeStore";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

export default function RootLayout() {
  const themeStoreHydrated = useThemeStore((s) => s.isHydrated);
  const themeMode = useThemeStore((s) => s.themeMode);
  const hydrateThemeStore = useThemeStore((s) => s.hydrate);
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    hydrateThemeStore();
    (async () => {
      try {
        const result = await GitInitializationService.instance.initialize();
        if (result.success) {
          console.log('[App] Git initialization succeeded:', {
            wasCloned: result.wasCloned,
            branch: result.status?.currentBranch,
          });
          try {
            await NoteService.instance.indexExistingNotes();
          } catch (e) {
            console.warn('[App] Failed to index existing notes:', e);
          }
        } else {
          console.error('[App] Git initialization failed:', result.error);
        }
      } catch (error) {
        console.error('[App] Git initialization error:', error);
      }
    })();
  }, [hydrateThemeStore]);

  // Determine which theme to use
  const effectiveTheme = useMemo(() => {
    const shouldUseDark =
      themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    return shouldUseDark ? createDarkTheme() : createLightTheme();
  }, [themeMode, systemColorScheme]);

  if (!themeStoreHydrated) {
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
