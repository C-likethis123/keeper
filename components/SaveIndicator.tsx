import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type SaveStatus = "idle" | "saving" | "saved";

type Props = {
	status: SaveStatus;
};

const titleMap = {
	saving: "Saving…",
	saved: "Saved",
	idle: "",
};

const iconNameMap = {
	saving: "sync",
	saved: "check-circle",
	idle: "edit",
} as const;

export function SaveIndicator({ status }: Props) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	const iconName = iconNameMap[status];

	// Use theme-aware colors with better contrast
	const iconColor = useMemo(() => {
		switch (status) {
			case "saving":
				return theme.dark ? "#fbbf24" : "#f59e0b"; // Lighter amber for dark mode
			case "saved":
				return theme.dark ? "#4ade80" : "#16a34a"; // Lighter green for dark mode
			case "idle":
				return theme.colors.textMuted;
			default:
				return theme.colors.text;
		}
	}, [status, theme]);

	return (
		<View style={styles.container}>
			<MaterialIcons name={iconName} size={16} color={iconColor} />
			<View style={styles.textContainer}>
				<Text style={styles.title} numberOfLines={1}>
					{titleMap[status]}
				</Text>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			maxWidth: 220,
		},
		textContainer: {
			flexShrink: 1,
		},
		title: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text, // Use theme text color for better contrast
		},
		subtitle: {
			fontSize: 11,
			color: theme.colors.textMuted,
		},
	});
}
