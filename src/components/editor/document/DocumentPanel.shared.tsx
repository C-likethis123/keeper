import type { ExtendedTheme } from "@/constants/themes/types";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";

export function DocumentPanelHeader({
	dismissLabel = "Close document panel",
	iconName,
	onDismiss,
	onOpenExternally,
	openExternalLabel = "Open externally",
	title,
	styles,
}: {
	dismissLabel?: string;
	iconName: React.ComponentProps<typeof FontAwesome>["name"];
	onDismiss: () => void;
	onOpenExternally?: () => void;
	openExternalLabel?: string;
	styles: ReturnType<typeof createDocumentPanelStyles>;
	title: string;
}) {
	return (
		<div className="keeper-layout" style={styles.header}>
			<FontAwesome name={iconName} size={14} style={styles.headerIcon} />
			<span
				className="keeper-copy"
				style={{
					...styles.filename,
					overflow: "hidden",
					display: "-webkit-box",
					WebkitBoxOrient: "vertical",
					WebkitLineClamp: 1,
				}}
			>
				{title}
			</span>
			{onOpenExternally ? (
				<button
					type="button"
					className="keeper-control"
					onClick={onOpenExternally}
					style={styles.dismissButton}
					aria-label={openExternalLabel}
				>
					<FontAwesome
						name="external-link"
						size={14}
						style={styles.dismissIcon}
					/>
				</button>
			) : null}
			<button
				type="button"
				className="keeper-control"
				onClick={onDismiss}
				style={styles.dismissButton}
				aria-label={dismissLabel}
			>
				<FontAwesome name="times" size={14} style={styles.dismissIcon} />
			</button>
		</div>
	);
}

export function openExternalUrl(url: string) {
	if (url) {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}

export function createDocumentPanelStyles(
	theme: ExtendedTheme,
	options: { showRightBorder: boolean },
) {
	return {
		panel: {
			flex: 1,
			backgroundColor: theme.colors.card,
			borderColor: theme.colors.border,
			borderRightWidth: options.showRightBorder ? 1 : 0,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 8,
			paddingBottom: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			gap: 8,
		},
		headerIcon: { color: theme.colors.textMuted },
		filename: {
			flex: 1,
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.text,
		},
		dismissButton: {
			width: 28,
			height: 28,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 14,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.background,
		},
		dismissIcon: { color: theme.colors.text },
		viewerContainer: { flex: 1, overflow: "hidden" },
	} satisfies Record<string, React.CSSProperties>;
}
