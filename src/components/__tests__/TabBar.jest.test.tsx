import { TabBar } from "@/components/TabBar";
import { useTabStore } from "@/stores/tabStore";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
	// wrap in arrow so the reference to mockReplace is resolved at call time,
	// not at jest.mock hoist time (when const mockReplace is not yet defined)
	router: {
		replace: (...args: unknown[]) => mockReplace(...args),
	},
}));

jest.mock("@expo/vector-icons", () => ({
	FontAwesome: ({ name }: { name: string }) => name,
}));

jest.mock("@/hooks/useStyles", () => ({
	useStyles: (fn: (theme: unknown) => unknown) =>
		fn({
			colors: {
				background: "#ffffff",
				card: "#f9fafb",
				border: "#d0d7de",
				text: "#111827",
				textMuted: "#6b7280",
			},
		}),
}));

function makeTab(
	id: string,
	noteId: string,
	title: string,
	isPinned = false,
) {
	return { id, noteId, title, isPinned };
}

function resetStore() {
	useTabStore.setState({ tabs: [], activeTabId: null });
}

describe("TabBar", () => {
	beforeEach(() => {
		resetStore();
		mockReplace.mockClear();
	});

	it("renders nothing on mobile when there is only one tab", () => {
		useTabStore.setState({
			tabs: [makeTab("tab-a", "note-1", "Only Note")],
			activeTabId: "tab-a",
		});
		const { toJSON } = render(<TabBar />);
		expect(toJSON()).toBeNull();
	});

	it("renders tab chips for each open tab", () => {
		useTabStore.setState({
			tabs: [
				makeTab("tab-a", "note-1", "Alpha"),
				makeTab("tab-b", "note-2", "Beta"),
			],
			activeTabId: "tab-b",
		});

		render(<TabBar />);

		expect(screen.getByText("Alpha")).toBeTruthy();
		expect(screen.getByText("Beta")).toBeTruthy();
	});

	it("activates tab and navigates to note on press", () => {
		useTabStore.setState({
			tabs: [
				makeTab("tab-a", "note-1", "Alpha"),
				makeTab("tab-b", "note-2", "Beta"),
			],
			activeTabId: "tab-b",
		});

		render(<TabBar />);
		fireEvent.press(screen.getByText("Alpha"));

		expect(useTabStore.getState().activeTabId).toBe("tab-a");
		expect(mockReplace).toHaveBeenCalledWith("/editor?id=note-1");
	});

	it("navigates to the next tab when closing the active tab", () => {
		useTabStore.setState({
			tabs: [
				makeTab("tab-a", "note-1", "Alpha"),
				makeTab("tab-b", "note-2", "Beta"),
			],
			activeTabId: "tab-a",
		});

		render(<TabBar />);
		fireEvent.press(screen.getByLabelText("Close Alpha"));

		expect(useTabStore.getState().tabs.map((t) => t.id)).not.toContain("tab-a");
		expect(mockReplace).toHaveBeenCalledWith("/editor?id=note-2");
	});

	it("navigates home when closing the only remaining tab", () => {
		useTabStore.setState({
			tabs: [
				makeTab("tab-a", "note-1", "Alpha"),
				makeTab("tab-b", "note-2", "Beta"),
			],
			activeTabId: "tab-b",
		});
		// Pre-close tab-a so only tab-b remains visible at render time — but we need
		// two tabs for TabBar to render. Set up so closing tab-b leaves no tabs.
		// Reset to two tabs, close the non-active one first, then re-render.
		// Simpler: directly have two tabs where closing the active leaves none.
		// Manually close tab-a from store so tab-b is alone, then restore two tabs.
		// Cleanest: set up two tabs, make tab-b active, both unpinned;
		// after close tab-b → tab-a becomes active → navigates to note-1.
		// To test "navigates home": make tab-b the only tab... but then TabBar hides.
		// So we test the case via handleCloseTab logic: closing last tab → router.replace("/").
		// We'll remove tab-a from the store after render so that when tab-b closes, no tabs remain.
		render(<TabBar />);

		// Remove tab-a so that closing tab-b leaves nothing
		useTabStore.setState({
			tabs: [makeTab("tab-b", "note-2", "Beta")],
			activeTabId: "tab-b",
		});

		fireEvent.press(screen.getByLabelText("Close Beta"));

		expect(useTabStore.getState().tabs).toHaveLength(0);
		expect(mockReplace).toHaveBeenCalledWith("/");
	});

	it("hides close button for pinned tabs", () => {
		useTabStore.setState({
			tabs: [
				makeTab("tab-a", "note-1", "Alpha", true),
				makeTab("tab-b", "note-2", "Beta"),
			],
			activeTabId: "tab-b",
		});

		render(<TabBar />);

		expect(screen.queryByLabelText("Close Alpha")).toBeNull();
		expect(screen.getByLabelText("Close Beta")).toBeTruthy();
	});
});
