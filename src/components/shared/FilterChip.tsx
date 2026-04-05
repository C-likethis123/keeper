import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

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
		<Pressable
			style={({ pressed }) => [
				styles.chip,
				selected && styles.chipSelected,
				pressed && styles.chipPressed,
			]}
			onPress={onPress}
			testID={testID}
		>
			<Text style={[styles.chipText, selected && styles.chipTextSelected]}>
				{label}
			</Text>
		</Pressable>
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
		chipPressed: {
			opacity: 0.8,
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
