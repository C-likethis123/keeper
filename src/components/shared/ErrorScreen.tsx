import "./shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";

type ErrorScreenProps = {
	error: Error;
	onRetry?: () => void;
};

export default function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
	const styles = useStyles(createStyles);

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<FontAwesome
					name="exclamation-circle"
					size={48}
					style={styles.errorIcon}
				/>
				<span style={styles.errorMessage}>{error.message}</span>
				{error.stack && <span style={styles.stackTrace}>{error.stack}</span>}
				{onRetry && (
					<button
						type="button"
						className="keeper-control"
						style={{ ...styles.retryButton }}
						onClick={onRetry}
					>
						<span style={styles.retryButtonText}>Retry</span>
					</button>
				)}
			</div>
		</div>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		container: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 32,
			backgroundColor: theme.colors.background,
		},
		content: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			maxWidth: 420,
			gap: 16,
		},
		errorIcon: {
			color: theme.colors.error,
		},
		errorMessage: {
			fontSize: 16,
			color: theme.colors.text,
			textAlign: "center",
			lineHeight: "22px",
		},
		stackTrace: {
			fontSize: 12,
			color: theme.colors.text,
			fontFamily: "monospace",
			textAlign: "left",
			marginTop: 8,
			opacity: 0.7,
		},
		retryButton: {
			display: "flex",
			flexDirection: "column",
			marginTop: 8,
			paddingLeft: 24,
			paddingRight: 24,
			paddingTop: 12,
			paddingBottom: 12,
			borderRadius: 8,
			backgroundColor: theme.colors.primary,
		},
		retryButtonText: {
			color: theme.colors.card,
			fontWeight: "600",
			fontSize: 15,
		},
	} satisfies Record<string, React.CSSProperties>;
}
