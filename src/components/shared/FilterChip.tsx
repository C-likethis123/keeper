import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import type { ExtendedTheme } from "@/constants/themes/types";

export function FilterChip({
	label,
	selected,
	onPress,
	testID,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	testID?: string;
}) {
	const styles = useStyles(createStyles);

	return (
		<TouchableOpacity
			style={[styles.chip, selected && styles.chipSelected]}
			onPress={onPress}
			activeOpacity={0.8}
			testID={testID}
		>
			<Text style={[styles.chipText, selected && styles.chipTextSelected]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		chip: {
			paddingHorizontal: 12,
			paddingVertical: 7,
			borderRadius: 999,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		chipSelected: {
			borderColor: theme.colors.primary,
			backgroundColor: theme.colors.primary,
		},
		chipText: {
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		chipTextSelected: {
			color: theme.colors.primaryContrast,
		},
	});
}
