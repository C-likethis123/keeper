import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
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

	const nativeSource = useMemo(
		() => ({ html: embedHtml, baseUrl: origin }),
		[embedHtml, origin],
	);

	return (
		<View style={[styles.panel, style]} testID={"embedded-video-panel"}>
			<View style={styles.header}>
				<Text style={styles.eyebrow}>Video</Text>
			</View>
			<View style={styles.playerFrame}>
				{Platform.OS === "web" ? (
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
				) : (
					<WebView
						allowsFullscreenVideo
						allowsInlineMediaPlayback
						mediaPlaybackRequiresUserAction={false}
						source={nativeSource}
						style={styles.webView}
					/>
				)}
			</View>
			<Text numberOfLines={1} style={styles.caption}>
				{source.rawUrl}
			</Text>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	const isWeb = Platform.OS === "web";
	return StyleSheet.create({
		panel: {
			borderWidth: isWeb ? 1 : 0,
			borderLeftWidth: 0,
			borderRightWidth: 0,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			borderRadius: isWeb ? 16 : 0,
			padding: isWeb ? 12 : 0,
			paddingVertical: isWeb ? 12 : 8,
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
			borderRadius: isWeb ? 12 : 0,
			backgroundColor: "#000000",
		},
		webView: {
			flex: 1,
			backgroundColor: "#000000",
		},
		caption: {
			fontSize: 12,
			color: theme.colors.textMuted,
			paddingHorizontal: isWeb ? 0 : 16,
		},
	});
}
