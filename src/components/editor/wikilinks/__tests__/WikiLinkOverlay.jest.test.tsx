import { WikiLinkOverlay } from "@/components/editor/wikilinks/WikiLinkOverlay";
import type { WikiLinkResult } from "@/components/editor/wikilinks/WikiLinkContext";
import { render, screen, userEvent } from "@testing-library/react-native";
import React from "react";

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			card: "#f9fafb",
			text: "#111827",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			primaryPressed: "#1d4ed8",
			shadow: "#000000",
		},
		custom: { editor: { placeholder: "#9ca3af" } },
		typography: { body: { fontSize: 16 } },
	}),
}));

jest.mock("@/components/shared/Loader", () => {
	const React = require("react");
	const { View, Text } = require("react-native");
	return {
		__esModule: true,
		default: () => React.createElement(View, null, React.createElement(Text, null, "Loading")),
	};
});

const RESULTS: WikiLinkResult[] = [
	{ id: "note-1", type: "existing", title: "Meeting Notes", noteId: "note-1" },
	{ id: "note-2", type: "existing", title: "Project Alpha", noteId: "note-2" },
	{ id: "create:new note", type: "create", title: "New Note" },
];

describe("WikiLinkOverlay", () => {
	it("renders existing note results", () => {
		render(
			<WikiLinkOverlay
				results={RESULTS.slice(0, 2)}
				selectedIndex={0}
				onSelect={jest.fn()}
			/>,
		);

		expect(screen.getByText("Meeting Notes")).toBeOnTheScreen();
		expect(screen.getByText("Project Alpha")).toBeOnTheScreen();
	});

	it("renders create option with quoted title", () => {
		render(
			<WikiLinkOverlay
				results={[RESULTS[2]]}
				selectedIndex={0}
				onSelect={jest.fn()}
			/>,
		);

		expect(screen.getByText('Create "New Note"')).toBeOnTheScreen();
	});

	it("calls onSelect with the result when a row is pressed", async () => {
		const onSelect = jest.fn();
		const user = userEvent.setup();
		render(
			<WikiLinkOverlay
				results={RESULTS.slice(0, 2)}
				selectedIndex={0}
				onSelect={onSelect}
			/>,
		);

		await user.press(screen.getByText("Project Alpha"));

		expect(onSelect).toHaveBeenCalledWith(RESULTS[1]);
	});

	it("shows the loader when isLoading is true", () => {
		render(
			<WikiLinkOverlay
				results={[]}
				selectedIndex={0}
				isLoading
				onSelect={jest.fn()}
			/>,
		);

		expect(screen.getByText("Loading")).toBeOnTheScreen();
	});

	it("does not show the loader when results are present", () => {
		render(
			<WikiLinkOverlay
				results={RESULTS.slice(0, 1)}
				selectedIndex={0}
				isLoading={false}
				onSelect={jest.fn()}
			/>,
		);

		expect(screen.queryByText("Loading")).not.toBeOnTheScreen();
	});
});
