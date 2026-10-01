import type { TabStripProps } from "@keeper/features/tabs/tab-contract";
import { FontAwesome } from "@expo/vector-icons";

/** DOM renderer. Behavior comes from the shared TabStripProps contract. */
export function BrowserTabStrip({
	tabs,
	activeTabId,
	activeView,
	onActivateHome,
	onActivateTab,
	onCloseTab,
	onTogglePin,
}: TabStripProps) {
	return (
		<div className="browser-tab-strip" role="tablist" aria-label="Open notes">
			<button
				className={
					activeView === "home"
						? "browser-tab browser-tab--active"
						: "browser-tab"
				}
				type="button"
				role="tab"
				aria-selected={activeView === "home"}
				onClick={onActivateHome}
			>
				<FontAwesome name="home" size={12} />
				<span>Home</span>
			</button>
			{tabs.map((tab) => {
				const active = activeView === "note" && activeTabId === tab.id;
				const title = tab.title || "Untitled";
				return (
					<div
						key={tab.id}
						className={
							active ? "browser-tab browser-tab--active" : "browser-tab"
						}
					>
						<button
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => onActivateTab(tab)}
							title={title}
						>
							<span>{title}</span>
						</button>
						<button
							type="button"
							className="browser-tab__pin"
							aria-label={`${tab.isPinned ? "Unpin" : "Pin"} ${title}`}
							onClick={() => onTogglePin(tab.id)}
						>
							{tab.isPinned ? (
								<FontAwesome name="thumb-tack" size={10} />
							) : null}
						</button>
						{!tab.isPinned ? (
							<button
								type="button"
								className="browser-tab__close"
								aria-label={`Close ${title}`}
								onClick={() => onCloseTab(tab.id)}
							>
								<FontAwesome name="times" size={12} />
							</button>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
