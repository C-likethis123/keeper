import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
export function SearchBar({
	searchQuery,
	setSearchQuery,
}: { searchQuery: string; setSearchQuery: (query: string) => void }) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.searchContainer}>
			<View style={styles.searchInputContainer}>
				<MaterialIcons
					name="search"
					size={20}
					color={theme.colors.textMuted}
					style={styles.searchIcon}
				/>
				<TextInput
					style={styles.searchInput}
					placeholder="Search"
					placeholderTextColor={theme.colors.textFaded}
					value={searchQuery}
					onChangeText={setSearchQuery}
					autoCapitalize="none"
					autoCorrect={false}
				/>
				{searchQuery.length > 0 && (
					<TouchableOpacity
						onPress={() => setSearchQuery("")}
						style={styles.clearButton}
					>
						<MaterialIcons
							name="close"
							size={18}
							color={theme.colors.textMuted}
						/>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		searchContainer: {
			paddingHorizontal: 16,
			paddingTop: 8,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
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
		searchIcon: {
			marginRight: 8,
		},
		searchInput: {
			flex: 1,
			fontSize: 16,
			color: theme.colors.text,
			paddingVertical: 0,
		},
		clearButton: {
			marginLeft: 8,
			padding: 4,
		},
	});
}
