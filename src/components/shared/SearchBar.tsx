import { webTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { FontAwesome } from "@expo/vector-icons";
import { forwardRef, useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export const SearchBar = forwardRef<
	TextInput,
	{
		searchQuery: string;
		setSearchQuery: (query: string) => void;
		editable?: boolean;
		compact?: boolean;
	}
>(function SearchBar(
	{ searchQuery, setSearchQuery, editable = true, compact = false },
	ref,
) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View
			style={[styles.searchContainer, compact && styles.searchContainerCompact]}
		>
			<View
				style={[
					styles.searchInputContainer,
					compact && styles.searchInputContainerCompact,
				]}
			>
				<FontAwesome name="search" size={20} style={styles.searchIcon} />
				<TextInput
					ref={ref}
					style={[styles.searchInput, compact && styles.searchInputCompact]}
					accessibilityLabel="Search notes"
					placeholder={"Search"}
					placeholderTextColor={theme.colors.textFaded}
					value={searchQuery}
					onChangeText={setSearchQuery}
					editable={editable}
					autoCapitalize="none"
					autoCorrect={false}
				/>
				{editable && searchQuery.length > 0 && (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Clear search"
						onPress={() => setSearchQuery("")}
						style={styles.clearButton}
					>
						<FontAwesome name="close" size={18} style={styles.closeIcon} />
					</Pressable>
				)}
			</View>
		</View>
	);
});

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		searchContainer: {
			flex: 1,
			paddingHorizontal: 16,
			paddingTop: 8,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
		},
		searchContainerCompact: {
			paddingHorizontal: 0,
			paddingTop: 0,
			paddingBottom: 0,
			backgroundColor: "transparent",
		},
		searchInputContainer: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.colors.card,
			borderRadius: 24,
			paddingHorizontal: 16,
			paddingVertical: 8,
			borderWidth: 0,
		},
		searchInputContainerCompact: {
			minHeight: 48,
			borderRadius: 16,
			paddingHorizontal: 14,
			paddingVertical: 6,
		},
		searchIcon: {
			marginRight: 8,
			color: theme.colors.textMuted,
		},
		closeIcon: {
			color: theme.colors.textMuted,
		},
		searchInput: {
			flex: 1,
			fontSize: 16,
			color: theme.colors.text,
			paddingVertical: 0,
			...webTextInputReset,
		},
		searchInputCompact: {
			fontSize: 15,
		},
		clearButton: {
			marginLeft: 8,
			padding: 4,
		},
	});
}
