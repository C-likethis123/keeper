import { Buffer } from "buffer";
import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { GitInitializationService } from "@/services/git/gitInitializationService";
import { getGitRuntimeSupport } from "@/services/git/runtime";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { checkForUpdates } from "@/utils/checkForUpdates";
import { useToastStore } from "@/stores/toastStore";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
	useColorScheme,
} from "react-native";
import "react-native-get-random-values";
global.Buffer = Buffer;
globalThis.Buffer = Buffer;

if (__DEV__) {
	require("../../wdyr");
}

export default function RootLayout() {
	const themeMode = useColorScheme();
	const [isHydrated, setIsHydrated] = useState(false);
	const [initError, setInitError] = useState<string | null>(null);
	const showToast = useToastStore((state) => state.showToast);
	useEffect(() => {
		const appStartTime = performance.now();

		if (!__DEV__) {
			checkForUpdates();
		}
		const initializeStorage = async () => {
			const result = await StorageInitializationService.instance.initialize();
			if (result.success && result.needsRebuild) {
				await NotesIndexService.rebuildFromDisk();
			}
			if (!result.success && result.readOnlyReason) {
				showToast(
					`Read-only mode: ${result.readOnlyReason}`,
					6000,
				);
			}
		};

		const initializeGit = async (backgroundMode: boolean) => {
			try {
				const result = await GitInitializationService.instance.initialize();
				if (!result.supported) {
					if (result.reason) {
						showToast(result.reason, 6000);
					}
					return;
				}
				if (result.success) {
					console.log("[App] Git initialization succeeded:", {
						wasCloned: result.wasCloned,
					});
					if (result.wasCloned) {
						console.log("[App] Git repository was cloned, indexing notes...");
						const metrics = await NotesIndexService.rebuildFromDisk();
						console.log("[App] notesIndexDbRebuildFromDisk", metrics);
					}
				} else {
					console.error("[App] Git initialization failed:", result.error);
					if (backgroundMode) {
						showToast(
							result.error ?? "Git sync failed",
							6000,
						);
					} else {
						setInitError(
							result.error ??
								"Rust git initialization failed. This runtime is unsupported.",
						);
					}
				}
			} catch (error) {
				console.error("[App] Git initialization error:", error);
				if (backgroundMode) {
					showToast(
						error instanceof Error ? error.message : "Git sync failed",
						6000,
					);
				} else {
					setInitError(
						error instanceof Error
							? error.message
							: "Rust git initialization failed unexpectedly.",
					);
				}
			}
		};
		(async () => {
			const runtimeSupport = getGitRuntimeSupport();
			if (runtimeSupport.runtime === "desktop-tauri") {
				// On Tauri desktop, hydrate immediately so the UI is never blocked
				// by IPC calls (storage init, git sync) that may stall indefinitely.
				// Both run after hydration; notes re-fetch once the backend is ready.
				setIsHydrated(true);
				await initializeStorage();
				void initializeGit(true);
			} else if (runtimeSupport.runtime === "mobile-native") {
				await initializeStorage();
				await initializeGit(false);
				const totalMs = Math.round(performance.now() - appStartTime);
				console.log(`[App] Startup: complete, total ${totalMs}ms`);
				setIsHydrated(true);
			} else {
				// Unsupported runtimes still launch in local-only mode.
				await initializeStorage();
				const totalMs = Math.round(performance.now() - appStartTime);
				if (runtimeSupport.reason) {
					showToast(runtimeSupport.reason, 6000);
				}
				console.log(`[App] Startup: complete, total ${totalMs}ms`);
				setIsHydrated(true);
			}
		})().catch((err) => {
			console.error("[App] Startup error:", err);
			setIsHydrated(true);
		});
	}, [showToast]);

	return (
		<ThemeProvider value={themeMode === "light" ? lightTheme : darkTheme}>
			<App isHydrated={isHydrated} initError={initError} />
		</ThemeProvider>
	);
}

const App = ({
	isHydrated,
	initError,
}: { isHydrated: boolean; initError: string | null }) => {
	const styles = useStyles(createStyles);
	if (!isHydrated) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<ActivityIndicator size="large" style={styles.activityIndicator} />
			</View>
		);
	}
	if (initError) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<Text style={styles.errorText}>{initError}</Text>
			</View>
		);
	}
	return (
		<>
			<Stack />
			<ToastOverlay />
		</>
	);
};

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		splash: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: theme.colors.background,
		},
		title: {
			fontSize: 32,
			fontWeight: "bold",
			color: theme.colors.primary,
		},
		activityIndicator: {
			marginTop: 16,
			color: theme.colors.primary,
		},
		errorText: {
			marginTop: 16,
			paddingHorizontal: 24,
			textAlign: "center",
			color: theme.colors.text,
		},
	});
}
