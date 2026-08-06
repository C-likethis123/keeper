import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import StartupScreen from "@/components/shared/StartupScreen";
import { ToastOverlay } from "@/components/shared/Toast";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useAppStartup } from "@/hooks/useAppStartup";
import { StartupReadyProvider } from "@/hooks/useStartupReady";
import { useStyles } from "@/hooks/useStyles";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { ThemeProvider } from "@react-navigation/native";
import { Drawer } from "expo-router/drawer";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";
import { SafeAreaProvider } from "react-native-safe-area-context";

traceStartupBootstrapEvent("bootstrap.layout_module_evaluated");

export default function RootLayout() {
	useEffect(() => {
		traceStartupBootstrapEvent("bootstrap.root_layout_first_render");
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
	const [isContentReady, setIsContentReady] = useState(false);
	const isCompletingStartup = useRef(false);
	const markContentReady = useCallback(() => {
		if (isCompletingStartup.current) return;
		isCompletingStartup.current = true;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setIsContentReady(true);
				requestAnimationFrame(() => {
					document.getElementById("keeper-startup-cover")?.remove();
				});
			});
		});
	}, []);
	useEffect(() => {
		if (initError) markContentReady();
	}, [initError, markContentReady]);

	const showStartup = !isHydrated || (!initError && !isContentReady);

	return (
		<View style={styles.root}>
			{showStartup ? (
				<View style={styles.startupOverlay}>
					<StartupScreen statusMessage={statusMessage} />
				</View>
			) : null}
			{isHydrated ? (
				initError ? (
					<View style={styles.splash}>
						<Text style={styles.title}>Keeper</Text>
						<Text style={styles.errorText}>{initError}</Text>
					</View>
				) : (
					<StartupReadyProvider onReady={markContentReady}>
						<Suspense fallback={null}>
							<SafeAreaProvider>
								<GestureHandlerRootView style={{ flex: 1 }}>
									<Drawer
										drawerContent={(props) => (
											<FilterDrawerContent {...props} />
										)}
										screenOptions={{
											headerShown: false,
											drawerType: "slide",
											swipeEnabled: true,
											drawerStyle: { width: 280 },
										}}
									>
										<Drawer.Screen name="index" />
										<Drawer.Screen
											name="editor"
											options={{ swipeEnabled: false }}
										/>
										<Drawer.Screen
											name="suggested-mocs"
											options={{ swipeEnabled: false }}
										/>
									</Drawer>
									<ToastOverlay />
								</GestureHandlerRootView>
							</SafeAreaProvider>
						</Suspense>
					</StartupReadyProvider>
				)
			) : null}
		</View>
	);
};

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		startupOverlay: {
			...StyleSheet.absoluteFillObject,
			zIndex: 1,
		},
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
		errorText: {
			marginTop: 16,
			paddingHorizontal: 24,
			textAlign: "center",
			color: theme.colors.text,
		},
	});
}
