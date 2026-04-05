import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { MaterialIcons } from "@expo/vector-icons";
import type React from "react";
import { Pressable, StyleSheet } from "react-native";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

export function IconButton({
	name,
	size = 24,
	onPress,
	disabled = false,
	testID,
}: {
	name: MaterialIconName;
	size?: number;
	onPress: () => void;
	disabled?: boolean;
	testID?: string;
}) {
	const styles = useStyles(createStyles);

	return (
		<Pressable
			style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
			onPress={onPress}
			disabled={disabled}
			testID={testID}
		>
			<MaterialIcons
				name={name}
				size={size}
				style={disabled ? styles.iconDisabled : styles.icon}
			/>
		</Pressable>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		button: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: theme.colors.background,
			justifyContent: "center" as const,
			alignItems: "center" as const,
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		buttonPressed: {
			opacity: 0.7,
		},
		icon: {
			color: theme.colors.text,
		},
		iconDisabled: {
			color: theme.colors.textDisabled,
		},
	});
}
