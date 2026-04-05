import { SearchBar } from "@/components/shared/SearchBar";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("@expo/vector-icons", () => ({
	FontAwesome: ({ name }: { name: string }) => name,
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
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
	it("clears the current query when the clear control is pressed", () => {
		const setSearchQuery = jest.fn();

		render(<SearchBar searchQuery="ideas" setSearchQuery={setSearchQuery} />);

		fireEvent.press(screen.getByRole("button", { name: "Clear search" }));

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
