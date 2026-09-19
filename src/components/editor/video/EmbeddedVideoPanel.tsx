import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { EmbeddedVideoSource } from "./videoUtils";
import { buildVideoEmbedHtml, resolveVideoEmbedOrigin } from "./videoUtils";

interface EmbeddedVideoPanelProps {
	source: EmbeddedVideoSource;
	style?: ViewStyle;
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
		<View style={[styles.panel, style]} testID={"embedded-video-panel"}>
			<View style={styles.header}>
				<Text style={styles.eyebrow}>Video</Text>
			</View>
			<View style={styles.playerFrame}>
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
			</View>
			<Text numberOfLines={1} style={styles.caption}>
				{source.rawUrl}
			</Text>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		panel: {
			borderWidth: 1,
			borderLeftWidth: 0,
			borderRightWidth: 0,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			borderRadius: 16,
			padding: 12,
			paddingVertical: 12,
			gap: 10,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 16,
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
			paddingHorizontal: 0,
		},
	});
}
