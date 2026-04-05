import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FontAwesomeName = React.ComponentProps<typeof FontAwesome>["name"];

export function IconButton({
	name,
	size = 22,
	onPress,
	disabled = false,
	testID,
	variant = "circle",
	label,
}: {
	name: FontAwesomeName;
	size?: number;
	onPress: () => void;
	disabled?: boolean;
	testID?: string;
	variant?: "circle" | "flat";
	label?: string;
}) {
	const styles = useStyles(createStyles);
	const [isHovered, setIsHovered] = React.useState(false);

	const showTooltip = variant === "flat" && isHovered && label != null;

	return (
		<View style={variant === "flat" ? styles.wrapperFlat : undefined}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				style={({ pressed }) => [
					variant === "circle"
						? [styles.buttonCircle, pressed && styles.buttonPressed]
						: [styles.buttonFlat, pressed && styles.buttonPressed],
				]}
				onPress={onPress}
				disabled={disabled}
				testID={testID}
				hitSlop={variant === "flat" ? 8 : undefined}
				onHoverIn={variant === "flat" ? () => setIsHovered(true) : undefined}
				onHoverOut={variant === "flat" ? () => setIsHovered(false) : undefined}
			>
				<FontAwesome
					name={name}
					size={size}
					style={
						variant === "circle"
							? [
									styles.icon,
									disabled && styles.iconDisabled,
								]
							: [
									styles.iconFlat,
									disabled && styles.iconDisabled,
								]
					}
				/>
			</Pressable>
			{showTooltip ? (
				<View pointerEvents="none" style={styles.tooltip}>
					<Text numberOfLines={1} style={styles.tooltipText}>
						{label}
					</Text>
				</View>
			) : null}
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		wrapperFlat: {
			position: "relative",
			alignItems: "center",
			justifyContent: "center",
		},
		buttonCircle: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: theme.colors.background,
			justifyContent: "center" as const,
			alignItems: "center" as const,
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		buttonFlat: {
			paddingVertical: 2,
		},
		buttonPressed: {
			opacity: 0.7,
		},
		icon: {
			color: theme.colors.text,
		},
		iconFlat: {
			color: theme.colors.textMuted,
		},
		iconDisabled: {
			color: theme.colors.textDisabled,
		},
		tooltip: {
			position: "absolute",
			bottom: "100%",
			marginBottom: 8,
			paddingHorizontal: 8,
			paddingVertical: 6,
			borderRadius: 8,
			backgroundColor: theme.colors.text,
			shadowColor: theme.colors.shadow,
			shadowOpacity: 0.14,
			shadowRadius: 8,
			shadowOffset: { width: 0, height: 4 },
			elevation: 4,
			zIndex: 10,
		},
		tooltipText: {
			fontSize: 12,
			fontWeight: "500",
			color: theme.colors.card,
		},
	});
}
