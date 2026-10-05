import { vi } from "vitest";
import { SearchBar } from "@/components/shared/SearchBar";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/components/shared/Icons", () => ({
	FontAwesome: ({ name }: { name: string }) => name,
}));

vi.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			card: "#f9fafb",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
		},
	}),
}));

describe("SearchBar", () => {
	it("forwards input ref and publishes typed query", () => {
		const ref = React.createRef<HTMLInputElement>();
		const setSearchQuery = vi.fn();
		render(
			<SearchBar ref={ref} searchQuery="" setSearchQuery={setSearchQuery} />,
		);
		const input = screen.getByRole("textbox", { name: "Search notes" });
		expect(ref.current).toBe(input);
		ref.current?.focus();
		expect(input).toHaveFocus();
		fireEvent.change(input, { target: { value: "ideas" } });
		expect(setSearchQuery).toHaveBeenCalledWith("ideas");
	});
	it("clears the current query when the clear control is pressed", () => {
		const setSearchQuery = vi.fn();

		render(<SearchBar searchQuery="ideas" setSearchQuery={setSearchQuery} />);

		fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

		expect(setSearchQuery).toHaveBeenCalledWith("");
	});

	it("does not render the clear control when not editable", () => {
		render(
			<SearchBar
				searchQuery="ideas"
				setSearchQuery={() => {}}
				editable={false}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
	});
});
