import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { useTabStore } from "@/stores/tabStore";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

export function TabBar() {
	const tabs = useTabStore((s) => s.tabs);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const activateTab = useTabStore((s) => s.activateTab);
	const closeTab = useTabStore((s) => s.closeTab);
	const pinTab = useTabStore((s) => s.pinTab);

	const styles = useStyles(createStyles);

	// On mobile, hide when there is 1 or fewer tabs
	if (Platform.OS !== "web" && tabs.length <= 1) {
		return null;
	}

	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				{tabs.map((tab) => {
					const isActive = tab.id === activeTabId;
					return (
						<Pressable
							key={tab.id}
							accessibilityRole="tab"
							accessibilityLabel={tab.title}
							accessibilityState={{ selected: isActive }}
							style={({ pressed }) => [
								styles.chip,
								isActive ? styles.chipActive : styles.chipInactive,
								pressed && styles.chipPressed,
							]}
							onPress={() => activateTab(tab.id)}
							onLongPress={() => pinTab(tab.id)}
						>
							{tab.isPinned && (
								<FontAwesome
									name="thumb-tack"
									size={10}
									style={styles.pinIcon}
								/>
							)}
							<Text
								numberOfLines={1}
								style={[styles.title, isActive && styles.titleActive]}
							>
								{tab.title}
							</Text>
							{!tab.isPinned && (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`Close ${tab.title}`}
									hitSlop={8}
									onPress={() => closeTab(tab.id)}
									style={styles.closeButton}
								>
									<FontAwesome
										name="times"
										size={12}
										style={styles.closeIcon}
									/>
								</Pressable>
							)}
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		container: {
			height: 40,
			backgroundColor: theme.colors.background,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		scrollContent: {
			alignItems: "center",
			paddingHorizontal: 4,
		},
		chip: {
			flexDirection: "row",
			alignItems: "center",
			height: 28,
			maxWidth: 180,
			paddingHorizontal: 10,
			marginHorizontal: 2,
			borderRadius: 6,
			borderWidth: 1,
		},
		chipActive: {
			backgroundColor: theme.colors.card,
			borderColor: theme.colors.border,
		},
		chipInactive: {
			backgroundColor: "transparent",
			borderColor: "transparent",
		},
		chipPressed: {
			opacity: 0.7,
		},
		pinIcon: {
			color: theme.colors.textMuted,
			marginRight: 4,
		},
		title: {
			flex: 1,
			fontSize: 13,
			color: theme.colors.textMuted,
		},
		titleActive: {
			color: theme.colors.text,
			fontWeight: "500",
		},
		closeButton: {
			marginLeft: 6,
			justifyContent: "center",
			alignItems: "center",
		},
		closeIcon: {
			color: theme.colors.textMuted,
		},
	});
}
