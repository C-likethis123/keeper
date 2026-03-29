import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export function FilterChip({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<TouchableOpacity
			style={[styles.chip, selected && styles.chipSelected]}
			onPress={onPress}
			activeOpacity={0.8}
		>
			<Text style={[styles.chipText, selected && styles.chipTextSelected]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
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
