import { Buffer } from "buffer";
// Import Buffer polyfill for isomorphic-git
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
	require("../wdyr");
}

export default function RootLayout() {
	const themeMode = useColorScheme();
	const [isHydrated, setIsHydrated] = useState(false);
	useEffect(() => {
		if (!__DEV__) {
			checkForUpdates();
		}
		const gitP = (async () => {
			try {
				const result = await GitInitializationService.instance.initialize();
				if (result.success) {
					console.log("[App] Git initialization succeeded:", {
						wasCloned: result.wasCloned,
						branch: result.status?.currentBranch,
					});
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
		Promise.allSettled([gitP]).then(() => {
			setIsHydrated(true);
		});
	}, []);

	return (
		<ThemeProvider value={themeMode === "light" ? lightTheme : darkTheme}>
			<App isHydrated={isHydrated} />
		</ThemeProvider>
	);
}

const App = ({ isHydrated }: { isHydrated: boolean }) => {
	const styles = useStyles(createStyles);
	if (!isHydrated) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<ActivityIndicator size="large" style={styles.activityIndicator} />
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
	});
}
