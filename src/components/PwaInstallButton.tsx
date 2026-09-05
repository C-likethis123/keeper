import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isInstalled(): boolean {
	return window.matchMedia("(display-mode: standalone)").matches ||
		(window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobileBrowser(): boolean {
	return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function PwaInstallButton() {
	const styles = useStyles(createStyles);
	const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
	const [installed, setInstalled] = useState(() =>
		typeof window === "undefined" ? true : isInstalled(),
	);

	useEffect(() => {
		if (Platform.OS !== "web") return;

		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			setInstallPrompt(event as InstallPromptEvent);
		};
		const handleInstalled = () => setInstalled(true);

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
			window.removeEventListener("appinstalled", handleInstalled);
		};
	}, []);

	if (Platform.OS !== "web") return null;
	if (installed) return null;

	const install = async () => {
		if (installPrompt) {
			await installPrompt.prompt();
			const choice = await installPrompt.userChoice;
			if (choice.outcome === "accepted") setInstalled(true);
			return;
		}

		window.alert(
			isAppleMobileBrowser()
				? "Tap Share, then Add to Home Screen."
				: "Use your browser menu and choose Install Keeper or Add to Home screen.",
		);
	};

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Install Keeper"
			style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
			onPress={() => void install()}
		>
			<FontAwesome name="download" size={14} style={styles.icon} />
			<Text style={styles.label}>Install</Text>
		</Pressable>
	);
}

function createStyles(theme: { colors: { border: string; text: string; textMuted: string } }) {
	return StyleSheet.create({
		button: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			minHeight: 32,
			paddingHorizontal: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 16,
		},
		buttonPressed: { opacity: 0.7 },
		icon: { color: theme.colors.textMuted },
		label: { color: theme.colors.text, fontSize: 13, fontWeight: "600" },
	});
}
