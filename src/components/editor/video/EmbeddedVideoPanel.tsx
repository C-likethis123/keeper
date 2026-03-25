import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { EmbeddedVideoLayout, EmbeddedVideoSource } from "./videoUtils";
import { getResumeEmbedUrl } from "./videoUtils";

interface EmbeddedVideoPanelProps {
	source: EmbeddedVideoSource;
	layout: EmbeddedVideoLayout;
	startSeconds?: number;
	onClose: () => void;
	onTimeUpdate?: (seconds: number) => void;
	onShrink?: () => void;
	onGrow?: () => void;
}

export function EmbeddedVideoPanel({
	source,
	layout,
	startSeconds,
	onClose,
	onTimeUpdate,
	onShrink,
	onGrow,
}: EmbeddedVideoPanelProps) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);

	// Track current time via a ref (no re-render needed)
	const currentTimeRef = useRef(0);

	// Web: listen for YouTube IFrame API postMessage events
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (Platform.OS !== "web") return;
		// onTimeUpdate may change on each render if consumer doesn't memoize —
		// this is expected; document it here rather than changing the logic.
		function handleMessage(event: MessageEvent) {
			try {
				const data =
					typeof event.data === "string" ? JSON.parse(event.data) : event.data;
				if (
					data?.event === "infoDelivery" &&
					typeof data?.info?.currentTime === "number"
				) {
					currentTimeRef.current = data.info.currentTime;
					onTimeUpdate?.(data.info.currentTime);
				}
			} catch {
				// ignore malformed messages
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [onTimeUpdate]);

	// Native: inject polling script to read video element current time
	const INJECT_TIME_POLLER = `
(function() {
  var lastTime = -1;
  setInterval(function() {
    var v = document.querySelector('video');
    if (v && Math.abs(v.currentTime - lastTime) > 0.5) {
      lastTime = v.currentTime;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'timeUpdate',
        time: v.currentTime
      }));
    }
  }, 3000);
})();
true;
`;

	function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
		try {
			const msg = JSON.parse(event.nativeEvent.data);
			if (msg.type === "timeUpdate" && typeof msg.time === "number") {
				currentTimeRef.current = msg.time;
				onTimeUpdate?.(msg.time);
			}
		} catch {
			// ignore
		}
	}

	// Compute active embed URL (with resume start if provided)
	const activeEmbedUrl =
		startSeconds && startSeconds > 0
			? getResumeEmbedUrl(source, startSeconds)
			: source.embedUrl;

	return (
		<View style={styles.panel} testID={`embedded-video-panel-${layout}`}>
			<View style={styles.header}>
				<View style={styles.headerText}>
					<Text style={styles.eyebrow}>Video</Text>
					<Text numberOfLines={1} style={styles.title}>
						{source.label}
					</Text>
				</View>
				<View style={styles.actions}>
					{layout === "side" ? (
						<>
							<Pressable
								accessibilityLabel="Shrink video panel"
								onPress={onShrink}
								style={styles.iconButton}
							>
								<MaterialIcons name="remove" size={18} color={theme.colors.text} />
							</Pressable>
							<Pressable
								accessibilityLabel="Expand video panel"
								onPress={onGrow}
								style={styles.iconButton}
							>
								<MaterialIcons name="add" size={18} color={theme.colors.text} />
							</Pressable>
						</>
					) : null}
					<Pressable
						accessibilityLabel="Close video panel"
						onPress={onClose}
						style={styles.iconButton}
					>
						<MaterialIcons name="close" size={18} color={theme.colors.text} />
					</Pressable>
				</View>
			</View>
			<View style={styles.playerFrame}>
				{Platform.OS === "web" ? (
					React.createElement("iframe", {
						src: activeEmbedUrl,
						title: source.label,
						allow:
							"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
						allowFullScreen: true,
						style: {
							border: "0",
							width: "100%",
							height: "100%",
							borderRadius: 12,
							backgroundColor: "#000",
						},
					})
				) : (
					<WebView
						allowsFullscreenVideo
						allowsInlineMediaPlayback
						injectedJavaScript={INJECT_TIME_POLLER}
						mediaPlaybackRequiresUserAction={false}
						onMessage={handleWebViewMessage}
						source={{ uri: activeEmbedUrl }}
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

function createStyles(
	theme: ReturnType<typeof useExtendedTheme>,
	layout: EmbeddedVideoLayout,
) {
	return StyleSheet.create({
		panel: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			borderRadius: 16,
			padding: 12,
			gap: 10,
			minHeight: layout === "side" ? 280 : 240,
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
			flex: 1,
			minHeight: layout === "side" ? 320 : 220,
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
