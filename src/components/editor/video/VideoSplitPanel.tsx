import "@/components/shared/shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";
import { EmbeddedVideoPanel } from "./EmbeddedVideoPanel";
import { parseEmbeddedVideoUrl } from "./videoUtils";

interface VideoSplitPanelProps {
	url: string;
	onDismiss: () => void;
	style?: React.CSSProperties;
}

export default function VideoSplitPanel({
	url,
	onDismiss,
	style,
}: VideoSplitPanelProps) {
	const styles = useStyles(createStyles);
	const source = parseEmbeddedVideoUrl(url);

	return (
		<div className="keeper-layout" style={{ ...styles.container, ...style }}>
			<button
				type="button"
				className="keeper-control"
				style={styles.dismissButton}
				onClick={onDismiss}
				aria-label="Remove video"
			>
				<FontAwesome name="times" size={16} style={styles.dismissIcon} />
			</button>
			{source ? (
				<EmbeddedVideoPanel source={source} style={styles.panel} />
			) : (
				<div className="keeper-layout" style={styles.invalidPanel}>
					<span className="keeper-copy" style={styles.invalidText}>
						Not a valid YouTube URL
					</span>
				</div>
			)}
		</div>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		container: { flex: 1 },
		panel: { flex: 1 },
		invalidPanel: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: 24,
			backgroundColor: theme.colors.card,
		},
		invalidText: { fontSize: 14, color: theme.colors.textMuted },
		dismissButton: {
			position: "absolute",
			top: 8,
			right: 8,
			zIndex: 10,
			width: 28,
			height: 28,
			borderRadius: 14,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.card,
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		dismissIcon: { color: theme.colors.text },
	} satisfies Record<string, React.CSSProperties>;
}
