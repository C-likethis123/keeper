import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import type { EmbeddedVideoSource, VideoMode } from "./videoUtils";

interface EmbeddedVideoPanelProps {
	source: EmbeddedVideoSource;
	style?: ViewStyle;
	mode: VideoMode;
	onToggleMode: () => void;
}

export function EmbeddedVideoPanel({
	source,
	style,
	mode = "normal",
	onToggleMode,
}: EmbeddedVideoPanelProps) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const { height: viewportHeight } = useWindowDimensions();

	const isMinimised = mode === "minimised";
	const playerFrameStyle = useMemo(
		() => ({
			height: Platform.OS === "web" ? ("50vh" as const) : viewportHeight * 0.5,
		}),
		[viewportHeight],
	);

	return (
		<View
			style={[styles.panel, isMinimised && styles.panelMinimised, style]}
			testID={"embedded-video-panel"}
		>
			<View style={styles.header}>
				<View style={styles.headerText}>
					<Text style={styles.eyebrow}>Video</Text>
				</View>
				<View style={styles.actions}>
					{
						<Pressable
							accessibilityLabel={
								isMinimised ? "Expand video panel" : "Minimize video panel"
							}
							onPress={onToggleMode}
							style={styles.iconButton}
						>
							<MaterialIcons
								name={isMinimised ? "expand-more" : "expand-less"}
								size={18}
								color={theme.colors.text}
							/>
						</Pressable>
					}
				</View>
			</View>

			{!isMinimised && (
				<>
					<View style={[styles.playerFrame, playerFrameStyle]}>
						{Platform.OS === "web" ? (
							<iframe
								src={source.embedUrl}
								title={"Youtube video"}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowFullScreen
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
								source={{ uri: source.embedUrl }}
								style={styles.webView}
							/>
						)}
					</View>
					<Text numberOfLines={1} style={styles.caption}>
						{source.rawUrl}
					</Text>
				</>
			)}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		panel: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			borderRadius: 16,
			padding: 12,
			gap: 10,
		},
		panelMinimised: {
			minHeight: 0,
			paddingBottom: 10,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
		},
		headerText: {
			flex: 1,
			gap: 2,
		},
		eyebrow: {
			fontSize: 11,
			fontWeight: "700",
			textTransform: "uppercase",
			color: theme.colors.textMuted,
		},
		title: {
			fontSize: 16,
			fontWeight: "700",
			color: theme.colors.text,
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
		},
		iconButton: {
			width: 32,
			height: 32,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 16,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.background,
		},
		playerFrame: {
			overflow: "hidden",
			borderRadius: 12,
			backgroundColor: "#000000",
		},
		webView: {
			flex: 1,
			backgroundColor: "#000000",
		},
		caption: {
			fontSize: 12,
			color: theme.colors.textMuted,
		},
	});
}
