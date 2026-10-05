import type React from "react";
import "@/components/shared/shared.css";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isPwaInstalled(): boolean {
	return (
		(typeof window.matchMedia === "function" &&
			window.matchMedia("(display-mode: standalone)").matches) ||
		(window.navigator as Navigator & { standalone?: boolean }).standalone ===
			true
	);
}

function isAppleMobileBrowser(): boolean {
	return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function PwaInstallButton() {
	const styles = useStyles(createStyles);
	const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
		null,
	);
	const [installed, setInstalled] = useState(() =>
		typeof window === "undefined" ? true : isPwaInstalled(),
	);

	useEffect(() => {
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			setInstallPrompt(event as InstallPromptEvent);
		};
		const handleInstalled = () => setInstalled(true);

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleInstalled);
		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
			window.removeEventListener("appinstalled", handleInstalled);
		};
	}, []);
	if (installed) return null;

	const install = async () => {
		if (installPrompt) {
			await installPrompt.prompt();
			const choice = await installPrompt.userChoice;
			setInstallPrompt(null);
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
		<button
			type="button"
			className="keeper-control"
			aria-label="Install Keeper"
			style={{ ...styles.button }}
			onClick={() => void install()}
		>
			<FontAwesome name="download" size={14} style={styles.icon} />
			<span className="keeper-copy" style={styles.label}>
				Install
			</span>
		</button>
	);
}

function createStyles(theme: {
	colors: { border: string; text: string; textMuted: string };
}) {
	return {
		button: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			minHeight: 32,
			paddingLeft: 10,
			paddingRight: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 16,
		},

		icon: { color: theme.colors.textMuted },
		label: { color: theme.colors.text, fontSize: 13, fontWeight: "600" },
	} satisfies Record<string, React.CSSProperties>;
}
