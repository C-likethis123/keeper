import { useTabStore } from "../tabStore";

function makeTab(id: string, noteId: string, title: string, isPinned = false) {
	return { id, noteId, title, isPinned };
}

function resetStore() {
	useTabStore.setState({ tabs: [], activeTabId: null });
}

describe("tabStore", () => {
	beforeEach(resetStore);

	describe("openTab", () => {
		it("opens a new tab and makes it active", () => {
			useTabStore.getState().openTab("note-1", "First Note");
			const { tabs, activeTabId } = useTabStore.getState();
			expect(tabs).toHaveLength(1);
			expect(tabs[0].noteId).toBe("note-1");
			expect(tabs[0].title).toBe("First Note");
			expect(tabs[0].isPinned).toBe(false);
			expect(activeTabId).toBe(tabs[0].id);
		});

		it("reuses an existing tab for the same noteId", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
				],
				activeTabId: "tab-b",
			});

			useTabStore.getState().openTab("note-1", "Alpha");

			const { tabs, activeTabId } = useTabStore.getState();
			expect(tabs).toHaveLength(2);
			expect(activeTabId).toBe("tab-a");
		});

		it("defaults title to Untitled when not provided", () => {
			useTabStore.getState().openTab("note-1");
			expect(useTabStore.getState().tabs[0].title).toBe("Untitled");
		});
	});

	describe("closeTab", () => {
		it("removes the tab from the list and clears active when last tab", () => {
			useTabStore.setState({
				tabs: [makeTab("tab-a", "note-1", "Alpha")],
				activeTabId: "tab-a",
			});

			useTabStore.getState().closeTab("tab-a");

			expect(useTabStore.getState().tabs).toHaveLength(0);
			expect(useTabStore.getState().activeTabId).toBeNull();
		});

		it("activates right neighbor when closing the active tab", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
					makeTab("tab-c", "note-3", "Gamma"),
				],
				activeTabId: "tab-a",
			});

			useTabStore.getState().closeTab("tab-a");

			expect(useTabStore.getState().activeTabId).toBe("tab-b");
		});

		it("activates left neighbor when closing the rightmost active tab", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
				],
				activeTabId: "tab-b",
			});

			useTabStore.getState().closeTab("tab-b");

			expect(useTabStore.getState().activeTabId).toBe("tab-a");
		});

		it("does not change active when closing a non-active tab", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
				],
				activeTabId: "tab-b",
			});

			useTabStore.getState().closeTab("tab-a");

			expect(useTabStore.getState().activeTabId).toBe("tab-b");
			expect(useTabStore.getState().tabs).toHaveLength(1);
		});

		it("does not close a pinned tab", () => {
			useTabStore.setState({
				tabs: [makeTab("tab-a", "note-1", "Alpha", true)],
				activeTabId: "tab-a",
			});

			useTabStore.getState().closeTab("tab-a");

			expect(useTabStore.getState().tabs).toHaveLength(1);
		});
	});

	describe("pinTab", () => {
		it("toggles pin state on a tab", () => {
			useTabStore.setState({
				tabs: [makeTab("tab-a", "note-1", "Alpha")],
				activeTabId: "tab-a",
			});

			useTabStore.getState().pinTab("tab-a");
			expect(useTabStore.getState().tabs[0].isPinned).toBe(true);

			useTabStore.getState().pinTab("tab-a");
			expect(useTabStore.getState().tabs[0].isPinned).toBe(false);
		});
	});

	describe("activateTab", () => {
		it("sets the active tab", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
				],
				activeTabId: "tab-b",
			});

			useTabStore.getState().activateTab("tab-a");

			expect(useTabStore.getState().activeTabId).toBe("tab-a");
		});

		it("ignores unknown tab ids", () => {
			useTabStore.setState({
				tabs: [makeTab("tab-a", "note-1", "Alpha")],
				activeTabId: "tab-a",
			});

			useTabStore.getState().activateTab("does-not-exist");

			expect(useTabStore.getState().activeTabId).toBe("tab-a");
		});
	});

	describe("updateTabTitle", () => {
		it("updates the title of the matching tab", () => {
			useTabStore.setState({
				tabs: [makeTab("tab-a", "note-1", "Old Title")],
				activeTabId: "tab-a",
			});

			useTabStore.getState().updateTabTitle("tab-a", "New Title");

			expect(useTabStore.getState().tabs[0].title).toBe("New Title");
		});
	});

	describe("closeAllUnpinned", () => {
		it("removes all unpinned tabs and activates the first pinned", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-pinned", "note-1", "Pinned", true),
					makeTab("tab-free", "note-2", "Free"),
				],
				activeTabId: "tab-free",
			});

			useTabStore.getState().closeAllUnpinned();

			const { tabs, activeTabId } = useTabStore.getState();
			expect(tabs).toHaveLength(1);
			expect(tabs[0].id).toBe("tab-pinned");
			expect(activeTabId).toBe("tab-pinned");
		});

		it("leaves no active tab when all tabs are unpinned", () => {
			useTabStore.setState({
				tabs: [
					makeTab("tab-a", "note-1", "Alpha"),
					makeTab("tab-b", "note-2", "Beta"),
				],
				activeTabId: "tab-a",
			});

			useTabStore.getState().closeAllUnpinned();

			expect(useTabStore.getState().tabs).toHaveLength(0);
			expect(useTabStore.getState().activeTabId).toBeNull();
		});
	});
});
