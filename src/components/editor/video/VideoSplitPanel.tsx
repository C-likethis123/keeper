import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import { EmbeddedVideoPanel } from "./EmbeddedVideoPanel";
import { parseEmbeddedVideoUrl } from "./videoUtils";

interface VideoSplitPanelProps {
	url: string;
	onDismiss: () => void;
	style?: ViewStyle;
}

export default function VideoSplitPanel({
	url,
	onDismiss,
	style,
}: VideoSplitPanelProps) {
	const styles = useStyles(createStyles);
	const source = parseEmbeddedVideoUrl(url);

	return (
		<View style={[styles.container, style]}>
			<Pressable
				style={styles.dismissButton}
				onPress={onDismiss}
				accessibilityRole="button"
				accessibilityLabel="Remove video"
			>
				<FontAwesome name="times" size={16} style={styles.dismissIcon} />
			</Pressable>
			{source ? (
				<EmbeddedVideoPanel source={source} style={styles.panel} />
			) : (
				<View style={styles.invalidPanel}>
					<Text style={styles.invalidText}>Not a valid YouTube URL</Text>
				</View>
			)}
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		container: {
			flex: 1,
		},
		panel: {
			flex: 1,
		},
		invalidPanel: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: 24,
			backgroundColor: theme.colors.card,
		},
		invalidText: {
			fontSize: 14,
			color: theme.colors.textMuted,
		},
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
		dismissIcon: {
			color: theme.colors.text,
		},
	});
}
