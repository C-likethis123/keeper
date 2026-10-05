import "./shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { useToastStore } from "@/stores/toastStore";
import type React from "react";

export const ToastOverlay = () => {
	const message = useToastStore((s) => s.message);
	const styles = useStyles(createStyles);
	if (!message) return null;
	return (
		<output className="keeper-toast" style={styles.toast}>
			<span style={styles.text}>{message}</span>
		</output>
	);
};

function createStyles(theme: ExtendedTheme) {
	return {
		toast: {
			boxShadow: `0 4px 8px ${theme.colors.shadow}`,
			display: "flex",
			flexDirection: "column",
			position: "absolute",
			bottom: 20,
			left: 20,
			right: 20,
			padding: 12,
			backgroundColor: theme.custom.toast.background,
			borderRadius: 8,
			alignItems: "center",
			zIndex: 9999,
		},
		text: { color: theme.custom.toast.text, fontWeight: "500" },
	} satisfies Record<string, React.CSSProperties>;
}
