import { FilterChip } from "@/components/shared/FilterChip";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			card: "#f9fafb",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			shadow: "#000000",
		},
	}),
}));

describe("FilterChip", () => {
	it("renders its label", () => {
		const { getByText } = render(
			<FilterChip label="Journals" selected={false} onPress={() => {}} />,
		);
		expect(getByText("Journals")).toBeTruthy();
	});

	it("calls onPress when tapped", () => {
		const onPress = jest.fn();
		const { getByText } = render(
			<FilterChip label="Todos" selected={false} onPress={onPress} />,
		);
		fireEvent.press(getByText("Todos"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("renders without error when selected", () => {
		const { getByText } = render(
			<FilterChip label="Notes" selected={true} onPress={() => {}} />,
		);
		expect(getByText("Notes")).toBeTruthy();
	});
});
