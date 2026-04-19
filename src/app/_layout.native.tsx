import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import ConflictResolutionModal from "@/components/shared/ConflictResolutionModal";
import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppStartup } from "@/hooks/useAppStartup";
import { useConflictResolution } from "@/hooks/useConflictResolution";
import { useFeedbackExport } from "@/hooks/useFeedbackExport";
import { useShareHandler } from "@/hooks/useShareHandler";
import { useStyles } from "@/hooks/useStyles";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { ThemeProvider } from "@react-navigation/native";
import { Drawer } from "expo-router/drawer";
import { ShareIntentProvider } from "expo-share-intent";
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
	}, []);
	const themeMode = useColorScheme();
	const { isHydrated, initError } = useAppStartup();

	return (
		<ThemeProvider value={themeMode === "light" ? lightTheme : darkTheme}>
			<ShareIntentProvider>
				<App isHydrated={isHydrated} initError={initError} />
			</ShareIntentProvider>
		</ThemeProvider>
	);
}

const App = ({
	isHydrated,
	initError,
}: { isHydrated: boolean; initError: string | null }) => {
	const styles = useStyles(createStyles);
	const {
		conflicts,
		isShowingModal,
		hideConflictModal,
		hasUnresolvedConflicts,
	} = useConflictResolution();
	const { exportFeedback } = useFeedbackExport();

	useShareHandler(isHydrated);

	// Debug trigger for feedback export (dev only)
	if (__DEV__) {
		// biome-ignore lint/suspicious/noExplicitAny: Debug-only global function
		(global as any).exportMocFeedback = exportFeedback;
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
				</Drawer>
				<ToastOverlay />
				{hasUnresolvedConflicts && (
					<ConflictResolutionModal
						visible={isShowingModal}
						conflicts={conflicts}
						onComplete={hideConflictModal}
					/>
				)}
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
		errorText: {
			marginTop: 16,
			paddingHorizontal: 24,
			textAlign: "center",
			color: theme.colors.text,
		},
	});
}
