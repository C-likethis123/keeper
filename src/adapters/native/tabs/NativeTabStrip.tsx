import type { ExtendedTheme } from "@/constants/themes/types";
import type { TabStripProps } from "@/features/tabs/tab-contract";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export function NativeTabStrip({ tabs, activeTabId, activeView, onActivateHome, onActivateTab, onCloseTab, onTogglePin }: TabStripProps) {
	const styles = useStyles(createStyles);
	return <View style={styles.container}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
		<Pressable accessibilityRole="tab" accessibilityLabel="Home" accessibilityState={{ selected: activeView === "home" }} style={({ pressed }) => [styles.chip, activeView === "home" ? styles.chipActive : styles.chipInactive, pressed && styles.chipPressed]} onPress={onActivateHome}><FontAwesome name="home" size={12} style={styles.homeIcon} /><Text style={[styles.title, activeView === "home" && styles.titleActive]}>Home</Text></Pressable>
		{tabs.map((tab) => { const active = activeView === "note" && tab.id === activeTabId; return <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.chip, active ? styles.chipActive : styles.chipInactive, pressed && styles.chipPressed]} onPress={() => onActivateTab(tab)} onLongPress={() => onTogglePin(tab.id)}>{tab.isPinned && <FontAwesome name="thumb-tack" size={10} style={styles.pinIcon} />}<Text numberOfLines={1} style={[styles.title, active && styles.titleActive]}>{tab.title}</Text>{!tab.isPinned && <Pressable accessibilityRole="button" accessibilityLabel={`Close ${tab.title}`} hitSlop={8} onPress={() => onCloseTab(tab.id)} style={styles.closeButton}><FontAwesome name="times" size={12} style={styles.closeIcon} /></Pressable>}</Pressable>; })}
	</ScrollView></View>;
}

function createStyles(theme: ExtendedTheme) { return StyleSheet.create({
	container: { height: 40, backgroundColor: theme.colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }, scrollContent: { alignItems: "center", paddingHorizontal: 4 }, chip: { flexDirection: "row", alignItems: "center", height: 28, maxWidth: 180, paddingHorizontal: 10, marginHorizontal: 2, borderRadius: 6, borderWidth: 1 }, chipActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, chipInactive: { backgroundColor: "transparent", borderColor: "transparent" }, chipPressed: { opacity: 0.7 }, pinIcon: { color: theme.colors.textMuted, marginRight: 4 }, homeIcon: { color: theme.colors.textMuted, marginRight: 6 }, title: { flex: 1, fontSize: 13, color: theme.colors.textMuted }, titleActive: { color: theme.colors.text, fontWeight: "500" }, closeButton: { marginLeft: 6, justifyContent: "center", alignItems: "center" }, closeIcon: { color: theme.colors.textMuted },
}); }
