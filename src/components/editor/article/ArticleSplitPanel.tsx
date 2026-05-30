import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	Linking,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";

interface ArticleSplitPanelProps {
	url: string;
	onDismiss: () => void;
	style?: ViewStyle;
}

export default function ArticleSplitPanel({
	url,
	onDismiss,
	style,
}: ArticleSplitPanelProps) {
	const styles = useStyles(createStyles);
	const source = useMemo(() => ({ uri: url }), [url]);

	return (
		<View style={[styles.container, style]} testID="article-split-panel">
			<View style={styles.header}>
				<Text style={styles.eyebrow}>Article</Text>
				<View style={styles.headerActions}>
					<Pressable
						accessibilityLabel="Open article externally"
						onPress={() => {
							void Linking.openURL(url);
						}}
						style={styles.iconButton}
					>
						<FontAwesome name="external-link" size={16} style={styles.icon} />
					</Pressable>
					<Pressable
						accessibilityLabel="Hide article"
						onPress={onDismiss}
						style={styles.iconButton}
					>
						<FontAwesome name="times" size={16} style={styles.icon} />
					</Pressable>
				</View>
			</View>
			<View style={styles.webFrame}>
				{Platform.OS === "web" ? (
					<iframe
						src={url}
						title="Article"
						style={{
							border: "0",
							width: "100%",
							height: "100%",
							backgroundColor: "#ffffff",
						}}
					/>
				) : (
					<WebView source={source} style={styles.webView} />
				)}
			</View>
			<Text numberOfLines={1} style={styles.caption}>
				{url}
			</Text>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	const isWeb = Platform.OS === "web";
	return StyleSheet.create({
		container: {
			flex: 1,
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
			justifyContent: "space-between",
			gap: 12,
			paddingHorizontal: 16,
		},
		eyebrow: {
			fontSize: 11,
			fontWeight: "700",
			textTransform: "uppercase",
			color: theme.colors.textMuted,
		},
		headerActions: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
		},
		iconButton: {
			width: 32,
			height: 32,
			alignItems: "center",
			justifyContent: "center",
		},
		icon: {
			color: theme.colors.textMuted,
		},
		webFrame: {
			flex: 1,
			overflow: "hidden",
			borderRadius: isWeb ? 12 : 0,
			backgroundColor: "#ffffff",
		},
		webView: {
			flex: 1,
			backgroundColor: "#ffffff",
		},
		caption: {
			fontSize: 12,
			color: theme.colors.textMuted,
			paddingHorizontal: isWeb ? 0 : 16,
		},
	});
}
