import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
	WikiLinkOverlay,
	type WikiLinkResult,
} from "@/components/editor/lexical/wikilinks/WikiLinkOverlay";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			card: "#f9fafb",
			text: "#111827",
			primary: "#2563eb",
			primaryContrast: "#ffffff",

			shadow: "#000000",
		},
		custom: { editor: { placeholder: "#9ca3af" } },
		typography: { body: { fontSize: 16 } },
	}),
}));

vi.mock("@/components/shared/Loader", async () => {
	const React = await import("react");
	return {
		default: () =>
			React.createElement(
				"div",
				null,
				React.createElement("span", null, "Loading"),
			),
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
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
		expect(screen.getByText("Project Alpha")).toBeInTheDocument();
	});

	it("renders create option with quoted title", () => {
		render(
			<WikiLinkOverlay
				results={[RESULTS[2]]}
				selectedIndex={0}
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByText('Create "New Note"')).toBeInTheDocument();
	});

	it("calls onSelect with the result when a row is pressed", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();
		render(
			<WikiLinkOverlay
				results={RESULTS.slice(0, 2)}
				selectedIndex={0}
				onSelect={onSelect}
			/>,
		);

		await user.click(screen.getByText("Project Alpha"));

		expect(onSelect).toHaveBeenCalledWith(RESULTS[1]);
	});

	it("shows the loader when isLoading is true", () => {
		render(
			<WikiLinkOverlay
				results={[]}
				selectedIndex={0}
				isLoading
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByText("Loading")).toBeInTheDocument();
	});

	it("does not show the loader when results are present", () => {
		render(
			<WikiLinkOverlay
				results={RESULTS.slice(0, 1)}
				selectedIndex={0}
				isLoading={false}
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.queryByText("Loading")).not.toBeInTheDocument();
	});
});
