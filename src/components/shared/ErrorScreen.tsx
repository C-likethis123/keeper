import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorScreenProps = {
	errorMessage: string;
	onRetry?: () => void;
};

export default function ErrorScreen({
	errorMessage,
	onRetry,
}: ErrorScreenProps) {
	const styles = useStyles(createStyles);

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<FontAwesome
					name="exclamation-circle"
					size={48}
					style={styles.errorIcon}
				/>
				<Text style={styles.errorMessage}>{errorMessage}</Text>
				{onRetry && (
					<Pressable
						style={({ pressed }) => [
							styles.retryButton,
							pressed && styles.retryButtonPressed,
						]}
						onPress={onRetry}
					>
						<Text style={styles.retryButtonText}>Retry</Text>
					</Pressable>
				)}
			</View>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		container: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 32,
			backgroundColor: theme.colors.background,
		},
		content: {
			alignItems: "center",
			maxWidth: 420,
			gap: 16,
		},
		errorIcon: {
			color: theme.colors.error,
		},
		errorMessage: {
			fontSize: 16,
			color: theme.colors.text,
			textAlign: "center",
			lineHeight: 22,
		},
		retryButton: {
			marginTop: 8,
			paddingHorizontal: 24,
			paddingVertical: 12,
			borderRadius: 8,
			backgroundColor: theme.colors.primary,
		},
		retryButtonPressed: {
			opacity: 0.8,
		},
		retryButtonText: {
			color: theme.colors.card,
			fontWeight: "600",
			fontSize: 15,
		},
	});
}
