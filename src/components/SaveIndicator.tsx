import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type SaveStatus = "idle" | "saving" | "saved";

type Props = {
	status: SaveStatus;
};

const titleMap = {
	saving: "Saving…",
	saved: "Saved",
};

const iconNameMap = {
	saving: "spinner" as const,
	saved: "check-circle" as const,
} as const;

export function SaveIndicator({ status }: Props) {
	const styles = useStyles(createStyles);

	if (status === "idle") {
		return null;
	}

	const iconName = iconNameMap[status];
	return (
		<View style={styles.container}>
			<FontAwesome
				name={iconName}
				size={16}
				style={status === "saving" ? styles.savingIcon : styles.savedIcon}
			/>
			<View style={styles.textContainer}>
				<Text style={styles.title} numberOfLines={1}>
					{titleMap[status]}
				</Text>
			</View>
		</View>
	);
}
function createStyles(theme: ExtendedTheme) {
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
			color: theme.colors.text,
		},
		subtitle: {
			fontSize: 11,
			color: theme.colors.textMuted,
		},
		icon: {
			color: theme.colors.text,
		},
		savingIcon: {
			color: theme.colors.statusSaving,
		},
		savedIcon: {
			color: theme.colors.statusSaved,
		},
	});
}
