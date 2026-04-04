import { IconButton } from "@/components/shared/IconButton";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

jest.mock("@expo/vector-icons", () => ({
	MaterialIcons: ({ name }: { name: string }) => name,
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
			textDisabled: "#d1d5db",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			shadow: "#000000",
		},
	}),
}));

describe("IconButton", () => {
	it("calls onPress when tapped", () => {
		const onPress = jest.fn();
		const { getByTestId } = render(
			<IconButton name="undo" onPress={onPress} testID="btn" />,
		);
		fireEvent.press(getByTestId("btn"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("does not call onPress when disabled", () => {
		const onPress = jest.fn();
		const { getByTestId } = render(
			<IconButton name="undo" onPress={onPress} disabled testID="btn" />,
		);
		fireEvent.press(getByTestId("btn"));
		expect(onPress).not.toHaveBeenCalled();
	});
});
