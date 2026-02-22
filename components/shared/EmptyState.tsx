import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type EmptyStateProps = {
	title: string;
	subtitle: string;
	actionLabel?: string;
	onActionPress?: () => void;
};

export default function EmptyState({
	title,
	subtitle,
	actionLabel,
	onActionPress,
}: EmptyStateProps) {
	const showAction = actionLabel && onActionPress;

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.subtitle}>{subtitle}</Text>
				{showAction && (
					<TouchableOpacity
						style={styles.button}
						onPress={onActionPress}
						activeOpacity={0.8}
					>
						<Ionicons
							name="settings-outline"
							size={18}
							color="#fff"
							style={styles.buttonIcon}
						/>
						<Text style={styles.buttonLabel}>{actionLabel}</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},

	content: {
		alignItems: "center",
		maxWidth: 420,
	},

	title: {
		marginTop: 16,
		fontSize: 20,
		fontWeight: "600",
		color: "rgba(60, 60, 67, 0.85)",
		textAlign: "center",
	},

	subtitle: {
		marginTop: 8,
		fontSize: 15,
		color: "rgba(60, 60, 67, 0.6)",
		textAlign: "center",
		lineHeight: 20,
	},

	button: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 24,
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 24,
		backgroundColor: "#2563eb", // primary
	},

	buttonIcon: {
		marginRight: 8,
	},

	buttonLabel: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 15,
	},
});
