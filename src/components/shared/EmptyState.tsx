import "./shared.css";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { Ionicons } from "@/components/shared/Icons";
import type React from "react";

type EmptyStateProps = {
	title: string;
	subtitle: string;
	actionLabel?: string;
	onActionPress?: () => void;
};

export default function EmptyState({
	title,
	subtitle,
	actionLabel,
	onActionPress,
}: EmptyStateProps) {
	const styles = useStyles(createStyles);
	const showAction = actionLabel && onActionPress;

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<span style={styles.title}>{title}</span>
				<span style={styles.subtitle}>{subtitle}</span>
				{showAction && (
					<button
						type="button"
						className="keeper-control"
						style={{ ...styles.button }}
						onClick={onActionPress}
					>
						<Ionicons
							name="create-outline"
							size={18}
							style={styles.buttonIcon}
						/>
						<span style={styles.buttonLabel}>{actionLabel}</span>
					</button>
				)}
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		container: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 32,
		},

		content: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			maxWidth: 420,
		},

		title: {
			marginTop: 16,
			fontSize: 20,
			fontWeight: "600",
			color: theme.colors.text,
			textAlign: "center",
		},

		subtitle: {
			marginTop: 8,
			fontSize: 15,
			color: theme.colors.textMuted,
			textAlign: "center",
			lineHeight: "20px",
		},

		button: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			marginTop: 24,
			paddingLeft: 20,
			paddingRight: 20,
			paddingTop: 12,
			paddingBottom: 12,
			borderRadius: 24,
			backgroundColor: theme.colors.primary,
		},

		buttonIcon: {
			marginRight: 8,
			color: theme.colors.primaryContrast,
		},

		buttonLabel: {
			color: theme.colors.primaryContrast,
			fontWeight: "600",
			fontSize: 15,
		},
	} satisfies Record<string, React.CSSProperties>;
}
