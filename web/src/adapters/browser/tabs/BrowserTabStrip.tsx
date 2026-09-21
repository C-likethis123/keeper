import type { TabStripProps } from "@keeper/features/tabs/tab-contract";

/** DOM renderer. Behavior comes from the shared TabStripProps contract. */
export function BrowserTabStrip({ tabs, activeTabId, activeView, onActivateHome, onActivateTab, onCloseTab, onTogglePin }: TabStripProps) {
	return <div className="browser-tab-strip" role="tablist" aria-label="Open notes">
		<button className={activeView === "home" ? "browser-tab browser-tab--active" : "browser-tab"} type="button" role="tab" aria-selected={activeView === "home"} onClick={onActivateHome}>⌂ <span>Home</span></button>
		{tabs.map((tab) => { const active = activeView === "note" && activeTabId === tab.id; return <div key={tab.id} className={active ? "browser-tab browser-tab--active" : "browser-tab"}><button type="button" role="tab" aria-selected={active} onClick={() => onActivateTab(tab)} title={tab.title}><span>{tab.title || "Untitled"}</span></button><button type="button" className="browser-tab__pin" aria-label={`${tab.isPinned ? "Unpin" : "Pin"} ${tab.title || "Untitled"}`} onClick={() => onTogglePin(tab.id)}>{tab.isPinned ? "⚑" : ""}</button>{!tab.isPinned && <button type="button" className="browser-tab__close" aria-label={`Close ${tab.title || "Untitled"}`} onClick={() => onCloseTab(tab.id)}>×</button>}</div>; })}
	</div>;
}
