import { Buffer } from "buffer";
import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { GitInitializationService } from "@/services/git/gitInitializationService";
import { notesIndexDbRebuildFromDisk } from "@/services/notes/notesIndexDb";
import { checkForUpdates } from "@/utils/checkForUpdates";
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
	useEffect(() => {
		const appStartTime = performance.now();

		if (!__DEV__) {
			checkForUpdates();
		}
		const gitP = (async () => {
			try {
				const result = await GitInitializationService.instance.initialize();
				if (result.success) {
					console.log("[App] Git initialization succeeded:", {
						wasCloned: result.wasCloned,
					});
					if (result.wasCloned) {
						console.log("[App] Git repository was cloned, indexing notes...");
						const metrics = await notesIndexDbRebuildFromDisk();
						console.log("[App] notesIndexDbRebuildFromDisk", metrics);
					}
				} else {
					console.error("[App] Git initialization failed:", result.error);
					setInitError(
						result.error ??
							"Rust git initialization failed. This runtime is unsupported.",
					);
				}
			} catch (error) {
				console.error("[App] Git initialization error:", error);
				setInitError(
					error instanceof Error
						? error.message
						: "Rust git initialization failed unexpectedly.",
				);
			}
		})();
		Promise.allSettled([gitP]).then(() => {
			const totalMs = Math.round(performance.now() - appStartTime);
			console.log(`[App] Startup: complete, total ${totalMs}ms`);
			setIsHydrated(true);
		});
	}, []);

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
