import { vi } from "vitest";
import { IconButton } from "@/components/shared/IconButton";
import { fireEvent, render } from "@testing-library/react";
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
			textDisabled: "#d1d5db",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			shadow: "#000000",
		},
	}),
}));

describe("IconButton", () => {
	it("calls onPress when tapped", () => {
		const onPress = vi.fn();
		const { getByTestId } = render(
			<IconButton name="undo" onPress={onPress} testID="btn" />,
		);
		fireEvent.click(getByTestId("btn"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("does not call onPress when disabled", () => {
		const onPress = vi.fn();
		const { getByTestId } = render(
			<IconButton name="undo" onPress={onPress} disabled testID="btn" />,
		);
		fireEvent.click(getByTestId("btn"));
		expect(onPress).not.toHaveBeenCalled();
	});

	it("positions flat tooltip at its trigger edge", () => {
		const { getByTestId } = render(
			<IconButton
				name="bars"
				label="Open filters"
				variant="flat"
				tooltipAlignment="start"
				onPress={vi.fn()}
				testID="btn"
			/>,
		);

		fireEvent.pointerEnter(getByTestId("btn"), { pointerType: "mouse" });

		expect(getByTestId("btn-tooltip")).toHaveStyle({ left: "0px" });
	});

	it("can position a flat tooltip below its trigger", () => {
		const { getByTestId } = render(
			<IconButton
				name="bars"
				label="Open filters"
				variant="flat"
				tooltipPlacement="bottom"
				onPress={vi.fn()}
				testID="btn"
			/>,
		);

		fireEvent.pointerEnter(getByTestId("btn"), { pointerType: "mouse" });

		expect(getByTestId("btn-tooltip")).toHaveStyle({
			top: "100%",
			marginTop: "8px",
		});
	});
});
