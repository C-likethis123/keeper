// stores/tabStore.ts
import { nanoid } from "nanoid";
import { create } from "zustand";

export interface Tab {
	id: string;
	noteId: string;
	title: string;
	isPinned: boolean;
}

interface TabState {
	tabs: Tab[];
	activeTabId: string | null;
	openTab: (noteId: string, title?: string) => void;
	closeTab: (tabId: string) => void;
	pinTab: (tabId: string) => void;
	activateTab: (tabId: string) => void;
	updateTabTitle: (noteId: string, title: string) => void;
	closeAllUnpinned: () => void;
}

export const useTabStore = create<TabState>((set) => ({
	tabs: [],
	activeTabId: null,

	openTab: (noteId, title = "Untitled") =>
		set((state) => {
			const existing = state.tabs.find((t) => t.noteId === noteId);
			if (existing) {
				return { activeTabId: existing.id };
			}
			const newTab: Tab = { id: nanoid(), noteId, title, isPinned: false };
			return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
		}),

	closeTab: (tabId) =>
		set((state) => {
			const tab = state.tabs.find((t) => t.id === tabId);
			if (!tab || tab.isPinned) return state;

			const index = state.tabs.indexOf(tab);
			const remaining = state.tabs.filter((t) => t.id !== tabId);

			let nextActiveId = state.activeTabId;
			if (state.activeTabId === tabId) {
				// prefer right neighbor, then left, then null
				const rightNeighbor = remaining[index]; // after removal, index points to the next item
				const leftNeighbor = remaining[index - 1];
				nextActiveId = rightNeighbor?.id ?? leftNeighbor?.id ?? null;
			}

			return { tabs: remaining, activeTabId: nextActiveId };
		}),

	pinTab: (tabId) =>
		set((state) => ({
			tabs: state.tabs.map((t) =>
				t.id === tabId ? { ...t, isPinned: !t.isPinned } : t,
			),
		})),

	activateTab: (tabId) => set({ activeTabId: tabId }),

	updateTabTitle: (noteId, title) =>
		set((state) => ({
			tabs: state.tabs.map((t) => (t.noteId === noteId ? { ...t, title } : t)),
		})),

	closeAllUnpinned: () =>
		set((state) => {
			const pinned = state.tabs.filter((t) => t.isPinned);
			const firstPinnedId = pinned[0]?.id ?? null;
			return { tabs: pinned, activeTabId: firstPinnedId };
		}),
}));
