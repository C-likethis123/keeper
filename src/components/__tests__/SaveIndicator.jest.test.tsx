import { SaveIndicator } from "@/components/SaveIndicator";
import { render, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		MaterialIcons: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

jest.mock("@/hooks/useStyles", () => ({
	useStyles: (factory: (theme: unknown) => unknown) =>
		factory({
			colors: {
				text: "#111827",
				textMuted: "#6b7280",
				statusSaving: "#f59e0b",
				statusSaved: "#16a34a",
			},
		}),
}));

describe("SaveIndicator", () => {
	it("renders nothing while idle", () => {
		const { toJSON } = render(<SaveIndicator status="idle" />);

		expect(toJSON()).toBeNull();
	});

	it("shows saving status copy and icon", () => {
		render(<SaveIndicator status="saving" />);

		expect(screen.getByText("Saving…")).toBeOnTheScreen();
		expect(screen.getByText("sync")).toBeOnTheScreen();
	});

	it("shows saved status copy and icon", () => {
		render(<SaveIndicator status="saved" />);

		expect(screen.getByText("Saved")).toBeOnTheScreen();
		expect(screen.getByText("check-circle")).toBeOnTheScreen();
	});
});
