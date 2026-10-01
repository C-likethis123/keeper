import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { useTabStore } from "@/stores/tabStore";
import { BrowserTabStrip } from "@web/adapters/browser/tabs/BrowserTabStrip";
import { PwaUpdateButton } from "@web/components/PwaUpdateButton";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DrawerContext = createContext<(() => void) | null>(null);

export function useOpenBrowserDrawer() {
	const openDrawer = useContext(DrawerContext);
	if (!openDrawer) throw new Error("Missing Vite shell drawer context");
	return openDrawer;
}

export function ViteAppShell({ children }: { children: ReactNode }) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const tabs = useTabStore((state) => state.tabs);
	const activeTabId = useTabStore((state) => state.activeTabId);
	const activateTab = useTabStore((state) => state.activateTab);
	const closeTab = useTabStore((state) => state.closeTab);
	const pinTab = useTabStore((state) => state.pinTab);
	const openDrawer = useCallback(() => setDrawerOpen(true), []);
	const closeDrawer = useCallback(() => setDrawerOpen(false), []);
	const drawerNavigation = useMemo(() => ({ closeDrawer }), [closeDrawer]);

	const selectTab = useCallback(
		(tab: (typeof tabs)[number]) => {
			activateTab(tab.id);
			navigate(`/editor/${tab.noteId}`);
		},
		[activateTab, navigate],
	);

	const removeTab = useCallback(
		(tabId: string) => {
			closeTab(tabId);
			if (location.pathname === "/") return;
			const state = useTabStore.getState();
			const next = state.tabs.find((tab) => tab.id === state.activeTabId);
			navigate(next ? `/editor/${next.noteId}` : "/");
		},
		[closeTab, location.pathname, navigate],
	);

	return (
		<DrawerContext.Provider value={openDrawer}>
			<div className="app-shell">
				<aside
					className={`drawer ${drawerOpen ? "drawer--open" : ""}`}
					aria-label="Keeper navigation and filters"
				>
					<div className="drawer__filters">
						<FilterDrawerContent navigation={drawerNavigation} />
					</div>
					<div className="drawer__pwa-actions">
						<PwaInstallButton />
						<PwaUpdateButton />
					</div>
				</aside>
				{drawerOpen ? (
					<button
						type="button"
						aria-label="Close navigation"
						className="drawer-backdrop"
						onClick={closeDrawer}
					/>
				) : null}
				<div className="app-main">
					<BrowserTabStrip
						tabs={tabs}
						activeTabId={activeTabId}
						activeView={location.pathname === "/" ? "home" : "note"}
						onActivateHome={() => navigate("/")}
						onActivateTab={selectTab}
						onCloseTab={removeTab}
						onTogglePin={pinTab}
					/>
					{children}
				</div>
			</div>
		</DrawerContext.Provider>
	);
}
