import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function StartupScreen({
	statusMessage = "",
}: {
	statusMessage?: string;
}) {
	const styles = useStyles(createStyles);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Keeper</Text>
			<ActivityIndicator size="large" style={styles.activityIndicator} />
			<View style={styles.statusSlot}>
				{statusMessage ? (
					<Text style={styles.statusText}>{statusMessage}</Text>
				) : null}
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
			backgroundColor: theme.colors.background,
		},
		title: {
			fontSize: 32,
			fontWeight: "bold",
			color: theme.colors.primary,
		},
		activityIndicator: {
			marginTop: 16,
			color: theme.colors.primary,
		},
		statusSlot: {
			height: 29,
			justifyContent: "flex-end",
		},
		statusText: {
			fontSize: 14,
			color: theme.colors.text,
			opacity: 0.6,
		},
	});
}
