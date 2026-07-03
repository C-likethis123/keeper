import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppStartup } from "@/hooks/useAppStartup";
import { useStyles } from "@/hooks/useStyles";
import { GitService } from "@/services/git/gitService";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { getTauriInvoke } from "@/services/storage/runtime";
import { ThemeProvider } from "@react-navigation/native";
import { Drawer } from "expo-router/drawer";
import { useEffect } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
	useColorScheme,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";
import { SafeAreaProvider } from "react-native-safe-area-context";

traceStartupBootstrapEvent("bootstrap.layout_module_evaluated");

export default function RootLayout() {
	useEffect(() => {
		traceStartupBootstrapEvent("bootstrap.root_layout_first_render");
		const saveAndFlushForExit = async () => {
			try {
				await GitService.saveCurrentEditorBeforeBackgroundFlush();
				await GitService.flushPendingChanges({
					reason: "app-background",
					timeoutMs: 5000,
				});
			} catch (error) {
				console.warn("[Web] Failed to save on app exit:", error);
			}
		};
		const handlePageHide = () => {
			void saveAndFlushForExit();
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				void saveAndFlushForExit();
			}
		};
		const browserWindow =
			typeof window !== "undefined" &&
			typeof window.addEventListener === "function"
				? window
				: null;
		const browserDocument =
			typeof document !== "undefined" &&
			typeof document.addEventListener === "function"
				? document
				: null;
		browserWindow?.addEventListener("pagehide", handlePageHide);
		browserDocument?.addEventListener(
			"visibilitychange",
			handleVisibilityChange,
		);

		// Tauri desktop: handle window close to flush pending git changes
		if (getTauriInvoke() !== null) {
			let unlisten: (() => void) | null = null;
			import("@tauri-apps/api/window")
				.then(({ getCurrentWindow }) => {
					let isClosing = false;
					return getCurrentWindow().onCloseRequested(async (event) => {
						if (isClosing) return;
						console.log("[Tauri] Close requested, preventing default...");
						// Prevent immediate close
						event.preventDefault();
						isClosing = true;
						try {
							console.log("[Tauri] Saving editor state...");
							await saveAndFlushForExit();
							console.log("[Tauri] Flush complete.");
						} catch (e) {
							console.warn("[Tauri] Failed to flush on close:", e);
						} finally {
							console.log("[Tauri] Closing window...");
							// Actually close the window
							await getCurrentWindow().close();
						}
					});
				})
				.then((u) => {
					unlisten = u;
				})
				.catch((err) => {
					console.warn("[Tauri] Failed to setup close listener:", err);
				});

			return () => {
				if (unlisten) unlisten();
				browserWindow?.removeEventListener("pagehide", handlePageHide);
				browserDocument?.removeEventListener(
					"visibilitychange",
					handleVisibilityChange,
				);
			};
		}
		return () => {
			browserWindow?.removeEventListener("pagehide", handlePageHide);
			browserDocument?.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
		};
	}, []);
	const themeMode = useColorScheme();
	const { isHydrated, initError, statusMessage } = useAppStartup();

	return (
		<ThemeProvider value={themeMode === "light" ? lightTheme : darkTheme}>
			<App
				isHydrated={isHydrated}
				initError={initError}
				statusMessage={statusMessage}
			/>
		</ThemeProvider>
	);
}

const App = ({
	isHydrated,
	initError,
	statusMessage,
}: {
	isHydrated: boolean;
	initError: string | null;
	statusMessage: string;
}) => {
	const styles = useStyles(createStyles);

	if (!isHydrated) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<ActivityIndicator size="large" style={styles.activityIndicator} />
				{!!statusMessage && (
					<Text style={styles.statusText}>{statusMessage}</Text>
				)}
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
		<SafeAreaProvider>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<Drawer
					drawerContent={(props) => <FilterDrawerContent {...props} />}
					screenOptions={{
						headerShown: false,
						drawerType: "slide",
						swipeEnabled: true,
						drawerStyle: { width: 280 },
					}}
				>
					<Drawer.Screen name="index" />
					<Drawer.Screen name="editor" options={{ swipeEnabled: false }} />
					<Drawer.Screen
						name="suggested-mocs"
						options={{ swipeEnabled: false }}
					/>
				</Drawer>
				<ToastOverlay />
			</GestureHandlerRootView>
		</SafeAreaProvider>
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
		statusText: {
			marginTop: 12,
			fontSize: 14,
			color: theme.colors.text,
			opacity: 0.6,
		},
		errorText: {
			marginTop: 16,
			paddingHorizontal: 24,
			textAlign: "center",
			color: theme.colors.text,
		},
	});
}
