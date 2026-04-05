import Loader from "@/components/shared/Loader";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SlashCommandItem } from "./SlashCommandContext";

interface SlashCommandOverlayProps {
	results: SlashCommandItem[];
	selectedIndex: number;
	isLoading?: boolean;
	onSelect: (item: SlashCommandItem) => void;
}

const MAX_HEIGHT = 200;
const ITEM_HEIGHT = 48;

export function SlashCommandOverlay({
	results,
	selectedIndex,
	isLoading = false,
	onSelect,
}: SlashCommandOverlayProps) {
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
									{item.title}
								</Text>
								<Text
									style={[
										styles.itemDescription,
										isSelected && styles.itemDescriptionSelected,
									]}
								>
									{item.description}
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
			minHeight: ITEM_HEIGHT,
			paddingHorizontal: 12,
			paddingVertical: 8,
			justifyContent: "center",
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
			fontWeight: "600",
		},
		itemTextSelected: {
			color: theme.colors.primaryContrast,
		},
		itemDescription: {
			fontSize: 13,
			color: theme.colors.textMuted,
			marginTop: 2,
		},
		itemDescriptionSelected: {
			color: theme.colors.primaryContrast,
			opacity: 0.85,
		},
	});
}
