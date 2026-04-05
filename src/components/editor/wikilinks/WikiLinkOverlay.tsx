import Loader from "@/components/shared/Loader";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { WikiLinkResult } from "./WikiLinkContext";

interface WikiLinkOverlayProps {
	results: WikiLinkResult[];
	selectedIndex: number;
	isLoading?: boolean;
	onSelect: (result: WikiLinkResult) => void;
}

const MAX_HEIGHT = 200;
const ITEM_HEIGHT = 40;

/// Dropdown overlay for wiki link autocomplete
export function WikiLinkOverlay({
	results,
	selectedIndex,
	isLoading = false,
	onSelect,
}: WikiLinkOverlayProps) {
	const styles = useStyles(createStyles);
	const needsScrolling = results.length * ITEM_HEIGHT > MAX_HEIGHT;
	return (
		<View style={styles.container}>
			{isLoading ? (
				<Loader />
			) : (
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
					scrollToOverflowEnabled
					nestedScrollEnabled
					showsVerticalScrollIndicator={needsScrolling}
				>
					{results.map((item, index) => {
						const isSelected = index === selectedIndex;
						const label =
							item.type === "create" ? `Create "${item.title}"` : item.title;
						return (
							<Pressable
								key={item.id}
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
								>
									{label}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		container: {
			maxHeight: MAX_HEIGHT,
			backgroundColor: theme.colors.card,
			borderRadius: 8,
			shadowColor: theme.colors.shadow,
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
			color: theme.colors.primaryContrast,
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
