import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useAppStartup } from "@/hooks/useAppStartup";
import { useStyles } from "@/hooks/useStyles";
import { appEvents } from "@/services/appEvents";
import { NoteService } from "@/services/notes/noteService";
import type { NoteType } from "@/services/notes/types";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { ThemeProvider } from "@react-navigation/native";
import * as Updates from "expo-updates";
import { Stack, router } from "expo-router";
import { nanoid } from "nanoid";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
	useColorScheme,
} from "react-native";
import "react-native-get-random-values";

let hasTracedRootLayoutRender = false;

traceStartupBootstrapEvent("bootstrap.layout_module_evaluated");

export default function RootLayout() {
	if (!hasTracedRootLayoutRender) {
		hasTracedRootLayoutRender = true;
		traceStartupBootstrapEvent("bootstrap.root_layout_first_render");
	}
	const themeMode = useColorScheme();
	const { isHydrated, initError } = useAppStartup();
	const { isUpdatePending, isDownloading } = Updates.useUpdates();

	return (
		<ThemeProvider value={themeMode === "light" ? lightTheme : darkTheme}>
			<App
				isHydrated={isHydrated}
				initError={initError}
				isDownloadingUpdate={isDownloading}
				isUpdatePending={isUpdatePending}
			/>
		</ThemeProvider>
	);
}

const App = ({
	isHydrated,
	initError,
	isDownloadingUpdate,
	isUpdatePending,
}: {
	isHydrated: boolean;
	initError: string | null;
	isDownloadingUpdate: boolean;
	isUpdatePending: boolean;
}) => {
	const styles = useStyles(createStyles);

	useAppKeyboardShortcuts({
		onFocusSearch: () => appEvents.emit("focusSearch"),
		onCreateNote: () => {
			const newNote = {
				id: nanoid(),
				title: "",
				content: "",
				lastUpdated: Date.now(),
				isPinned: false,
				noteType: "note" as NoteType,
			};
			void NoteService.saveNote(newNote, true).then(() => {
				router.push(`/editor?id=${newNote.id}`);
			});
		},
		onForceSave: () => appEvents.emit("forceSave"),
	});

	if (isDownloadingUpdate || isUpdatePending) {
		return (
			<View style={styles.splash}>
				<Text style={styles.title}>Keeper</Text>
				<ActivityIndicator size="large" style={styles.activityIndicator} />
				<Text style={styles.updateText}>
					{isUpdatePending ? "Applying update..." : "Downloading update..."}
				</Text>
			</View>
		);
	}
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
		updateText: {
			marginTop: 12,
			fontSize: 14,
			color: theme.colors.text,
		},
	});
}
