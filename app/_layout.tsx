// Import Buffer polyfill for isomorphic-git
import { Buffer } from "buffer";
global.Buffer = Buffer;
globalThis.Buffer = Buffer;

if (__DEV__) {
	require("../wdyr");
}

import { ToastOverlay } from "@/components/shared/Toast";
import { createDarkTheme } from "@/constants/themes/darkTheme";
import { createLightTheme } from "@/constants/themes/lightTheme";
import { GitInitializationService } from "@/services/git/gitInitializationService";
import { notesIndexDbRebuildFromDisk } from "@/services/notes/notesIndexDb";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useThemeStore } from "@/stores/themeStore";
import { checkForUpdates } from "@/utils/checkForUpdates";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
	useColorScheme,
} from "react-native";

let hasHydratedOnce = false;

export default function RootLayout() {
	const themeMode = useThemeStore((s) => s.themeMode);
	const hydrateThemeStore = useThemeStore((s) => s.hydrate);
	const systemColorScheme = useColorScheme();
	const [isHydrated, setIsHydrated] = useState(hasHydratedOnce);
	const clearCache = useNoteStore((s) => s.clearCache);
	useEffect(() => {
		if (!__DEV__) {
			checkForUpdates();
		}
		const themeP = hydrateThemeStore().then(
			() => {},
			(e) => {
				console.error("[App] Theme hydrate error:", e);
			},
		);
		const gitP = (async () => {
			try {
				const result = await GitInitializationService.instance.initialize();
				if (result.success) {
					console.log("[App] Git initialization succeeded:", {
						wasCloned: result.wasCloned,
						branch: result.status?.currentBranch,
					});
					clearCache();
					if (result.wasCloned) {
						console.log("[App] Git repository was cloned, indexing notes...");
						await notesIndexDbRebuildFromDisk();
					}
				} else {
					console.error("[App] Git initialization failed:", result.error);
				}
			} catch (error) {
				console.error("[App] Git initialization error:", error);
			}
		})();
		Promise.allSettled([themeP, gitP]).then(() => {
			hasHydratedOnce = true;
			setIsHydrated(true);
		});
	}, [hydrateThemeStore, clearCache]);

	// Determine which theme to use
	const effectiveTheme = useMemo(() => {
		const shouldUseDark =
			themeMode === "dark" ||
			(themeMode === "system" && systemColorScheme === "dark");
		return shouldUseDark ? createDarkTheme() : createLightTheme();
	}, [themeMode, systemColorScheme]);

	if (!isHydrated && !hasHydratedOnce) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<ActivityIndicator
					size="large"
					color="#2563eb"
					style={{ marginTop: 16 }}
				/>
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
