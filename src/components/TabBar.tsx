import { NativeTabStrip } from "@/adapters/native/tabs/NativeTabStrip";
import { editorPath } from "@/features/tabs/tab-controller";
import { useTabStore } from "@/stores/tabStore";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Platform } from "react-native";

export function TabBar({ activeView = "note" }: { activeView?: "home" | "note" }) {
	const tabs = useTabStore((s) => s.tabs);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const activateTab = useTabStore((s) => s.activateTab);
	const closeTab = useTabStore((s) => s.closeTab);
	const pinTab = useTabStore((s) => s.pinTab);

	const handleActivateHome = useCallback(() => {
		router.replace("/");
	}, []);

	const handleActivateTab = useCallback(
		(tab: (typeof tabs)[number]) => {
			activateTab(tab.id);
			router.replace(editorPath(tab) as never);
		},
		[activateTab],
	);

	const handleCloseTab = useCallback(
		(tabId: string) => {
			closeTab(tabId);
			if (activeView === "home") {
				return;
			}
			// After closing, navigate based on new store state
			const { activeTabId: nextActiveId, tabs: remainingTabs } =
				useTabStore.getState();
			const nextTab = remainingTabs.find((tab) => tab.id === nextActiveId);
		router.replace(nextTab ? (editorPath(nextTab) as never) : "/");
		},
		[activeView, closeTab],
	);

	// On mobile, hide when there is 1 or fewer tabs
	if (Platform.OS !== "web" && tabs.length <= 1) {
		return null;
	}

	return <NativeTabStrip tabs={tabs} activeTabId={activeTabId} activeView={activeView} onActivateHome={handleActivateHome} onActivateTab={handleActivateTab} onCloseTab={handleCloseTab} onTogglePin={pinTab} />;
}
