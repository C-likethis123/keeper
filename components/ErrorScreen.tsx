import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ErrorScreenProps = {
	errorMessage: string;
	onRetry?: () => void;
};

export default function ErrorScreen({
	errorMessage,
	onRetry,
}: ErrorScreenProps) {
	const theme = useExtendedTheme();
	const styles = createStyles(theme);

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<MaterialIcons
					name="error-outline"
					size={48}
					color={theme.colors.error}
				/>
				<Text style={styles.errorMessage}>{errorMessage}</Text>
				{onRetry && (
					<TouchableOpacity
						style={styles.retryButton}
						onPress={onRetry}
						activeOpacity={0.8}
					>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
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
		retryButtonText: {
			color: theme.colors.card,
			fontWeight: "600",
			fontSize: 15,
		},
	});
}
