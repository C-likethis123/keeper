import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

interface WikiLinkOverlayProps {
	results: string[];
	selectedIndex: number;
	isLoading?: boolean;
	query?: string;
	onSelect: (title: string) => void;
}

const MAX_HEIGHT = 200;
const ITEM_HEIGHT = 40;

/// Dropdown overlay for wiki link autocomplete
export function WikiLinkOverlay({
	results,
	selectedIndex,
	isLoading = false,
	query = "",
	onSelect,
}: WikiLinkOverlayProps) {
	const theme = useExtendedTheme();

	const styles = createStyles(theme);
	const needsScrolling = results.length * ITEM_HEIGHT > MAX_HEIGHT;

	return (
		<View style={styles.container}>
			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="small" color={theme.colors.primary} />
					<Text style={styles.loadingText}>Searching...</Text>
				</View>
			) : results.length > 0 ? (
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					scrollEnabled={needsScrolling}
					nestedScrollEnabled={true}
					showsVerticalScrollIndicator={needsScrolling}
				>
					{results.map((item, index) => {
						const isSelected = index === selectedIndex;
						return (
							<Pressable
								key={`${item}-${index}`}
								onPress={() => onSelect(item)}
								style={({ pressed }) => [
									styles.item,
									isSelected && styles.itemSelected,
									pressed && styles.itemPressed,
								]}
							>
								<Text
									style={[
										styles.itemText,
										isSelected && styles.itemTextSelected,
									]}
									numberOfLines={1}
									ellipsizeMode="tail"
								>
									{item}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			) : query.length > 0 ? (
				<View style={styles.loadingContainer}>
					<Text style={styles.loadingText}>No notes found</Text>
				</View>
			) : null}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			maxHeight: MAX_HEIGHT,
			maxWidth: 200,
			backgroundColor: theme.colors.card,
			borderRadius: 8,
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.25,
			shadowRadius: 8,
			elevation: 8,
			overflow: "hidden",
		},
		scrollView: {
			flexGrow: 0,
		},
		scrollContent: {
			paddingVertical: 4,
		},
		item: {
			height: ITEM_HEIGHT,
			paddingHorizontal: 12,
			justifyContent: "center",
			minHeight: ITEM_HEIGHT,
		},
		itemSelected: {
			// Use a more visible background color with better contrast
			backgroundColor: theme.colors.primary,
		},
		itemPressed: {
			backgroundColor: theme.colors.primaryPressed,
			opacity: 0.9,
		},
		itemText: {
			fontSize: theme.typography.body.fontSize || 16,
			color: theme.colors.text,
		},
		itemTextSelected: {
			// Use white text on primary background for maximum contrast
			color: "#FFFFFF",
			fontWeight: "600",
		},
		loadingContainer: {
			height: ITEM_HEIGHT,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 12,
			gap: 8,
		},
		loadingText: {
			fontSize: theme.typography.body.fontSize || 16,
			color: theme.colors.text,
			opacity: 0.6,
		},
	});
}
