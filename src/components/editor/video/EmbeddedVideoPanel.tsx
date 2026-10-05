import "@/components/shared/shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";
import { useMemo } from "react";
import type { EmbeddedVideoSource } from "./videoUtils";
import { buildVideoEmbedHtml, resolveVideoEmbedOrigin } from "./videoUtils";

interface EmbeddedVideoPanelProps {
	source: EmbeddedVideoSource;
	style?: React.CSSProperties;
}

export function EmbeddedVideoPanel({ source, style }: EmbeddedVideoPanelProps) {
	const styles = useStyles(createStyles);
	const origin = useMemo(
		() => resolveVideoEmbedOrigin() ?? "https://myapp.local",
		[],
	);

	const embedHtml = useMemo(
		() => buildVideoEmbedHtml(source.embedUrl, origin),
		[source.embedUrl, origin],
	);

	return (
		<div
			className="keeper-layout"
			style={{ ...styles.panel, ...style }}
			data-testid={"embedded-video-panel"}
		>
			<div className="keeper-layout" style={styles.header}>
				<span className="keeper-copy" style={styles.eyebrow}>
					Video
				</span>
			</div>
			<div className="keeper-layout" style={styles.playerFrame}>
				<iframe
					srcDoc={embedHtml}
					title={"Youtube video"}
					style={{
						border: "0",
						width: "100%",
						height: "100%",
						borderRadius: 12,
						backgroundColor: "#000",
					}}
				/>
			</div>
			<span
				className="keeper-copy"
				style={{
					...styles.caption,
					overflow: "hidden",
					display: "-webkit-box",
					WebkitBoxOrient: "vertical",
					WebkitLineClamp: 1,
				}}
			>
				{source.rawUrl}
			</span>
		</div>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		panel: {
			borderWidth: 1,
			borderLeftWidth: 0,
			borderRightWidth: 0,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			borderRadius: 16,
			padding: 12,
			paddingTop: 12,
			paddingBottom: 12,
			gap: 10,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingLeft: 16,
			paddingRight: 16,
		},
		eyebrow: {
			fontSize: 11,
			fontWeight: "700",
			textTransform: "uppercase",
			color: theme.colors.textMuted,
		},
		playerFrame: {
			flex: 1,
			overflow: "hidden",
			borderRadius: 12,
			backgroundColor: "#000000",
		},
		caption: {
			fontSize: 12,
			color: theme.colors.textMuted,
			paddingLeft: 0,
			paddingRight: 0,
		},
	} satisfies Record<string, React.CSSProperties>;
}
