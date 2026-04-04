import type { ExtendedTheme } from "@/constants/themes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import type React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

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
	const theme = useExtendedTheme();
	const styles = StyleSheet.create(createStyles(theme));

	return (
		<TouchableOpacity
			style={styles.button}
			onPress={onPress}
			disabled={disabled}
			activeOpacity={0.7}
			testID={testID}
		>
			<MaterialIcons
				name={name}
				size={size}
				color={disabled ? theme.colors.textDisabled : theme.colors.text}
			/>
		</TouchableOpacity>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
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
	};
}
