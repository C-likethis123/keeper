import { IconButton } from "@/components/shared/IconButton";
import { SearchBar } from "@/components/shared/SearchBar";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import type React from "react";
import { StyleSheet, type TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreenHeader({
	searchQuery,
	setSearchQuery,
	searchInputRef,
	onMenuPress,
	onReset,
	resetDisabled = false,
}: {
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	searchInputRef?: React.Ref<TextInput>;
	onMenuPress: () => void;
	onReset: () => void;
	resetDisabled?: boolean;
}) {
	const styles = useStyles(createStyles);
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.shell, { paddingTop: insets.top + 12 }]}>
			<View style={styles.row}>
				<IconButton
					name="bars"
					label="Open filters"
					variant="flat"
					onPress={onMenuPress}
				/>
				<SearchBar
					ref={searchInputRef}
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					compact
				/>
				<View style={styles.actions}>
					<IconButton
						label="Clear filters"
						name="trash"
						variant="flat"
						onPress={onReset}
						disabled={resetDisabled}
					/>
				</View>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		shell: {
			position: "relative",
			zIndex: 40,
			elevation: 8,
			paddingHorizontal: 16,
			paddingTop: 12,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-end",
			minWidth: 48,
		},
	});
}
