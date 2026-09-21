/** Platform-neutral tab strip contract. Renderers own toolkit. */
export type EditorTab = {
	id: string;
	noteId: string;
	title: string;
	isPinned: boolean;
	isNew: boolean;
};

export type TabStripProps = {
	tabs: readonly EditorTab[];
	activeTabId: string | null;
	activeView: "home" | "note";
	onActivateHome: () => void;
	onActivateTab: (tab: EditorTab) => void;
	onCloseTab: (tabId: string) => void;
	onTogglePin: (tabId: string) => void;
};
