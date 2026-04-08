import { render, screen } from "@testing-library/react-native";
import type React from "react";

const mockUseAppStartup = jest.fn();

jest.mock("@react-navigation/native", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/constants/themes/darkTheme", () => ({
	darkTheme: {
		colors: {
			background: "#000",
			primary: "#fff",
			text: "#fff",
		},
	},
}));

jest.mock("@/constants/themes/lightTheme", () => ({
	lightTheme: {
		colors: {
			background: "#fff",
			primary: "#000",
			text: "#222",
		},
	},
}));

jest.mock("expo-router/drawer", () => ({
	Drawer: Object.assign(
		({ children }: { children: React.ReactNode }) => {
			const React = require("react");
			return React.createElement(
				React.Fragment,
				null,
				React.createElement(require("react-native").Text, null, "Drawer"),
				children,
			);
		},
		{ Screen: ({ children }: { children?: React.ReactNode }) => children },
	),
}));

jest.mock("@/components/shared/Toast", () => ({
	ToastOverlay: () => {
		const React = require("react");
		const { Text } = require("react-native");
		return React.createElement(Text, null, "Toast overlay");
	},
}));

jest.mock("@/components/FilterDrawerContent", () => ({
	FilterDrawerContent: () => {
		const React = require("react");
		const { Text } = require("react-native");
		return React.createElement(Text, null, "Filter drawer");
	},
}));

jest.mock("react-native-gesture-handler", () => ({
	GestureHandlerRootView: ({
		children,
	}: {
		children: React.ReactNode;
	}) => children,
}));

jest.mock("@/components/shared/StartupScreen", () => ({
	__esModule: true,
	default: ({
		mode,
		message,
	}: {
		mode: "loading" | "error";
		message?: string;
	}) => {
		const React = require("react");
		const { Text, View } = require("react-native");
		return React.createElement(View, null, [
			React.createElement(Text, { key: "title" }, "Keeper"),
			mode === "loading"
				? React.createElement(Text, { key: "loading" }, "Loading")
				: React.createElement(Text, { key: "error" }, message),
		]);
	},
}));

jest.mock("@/hooks/useAppStartup", () => ({
	useAppStartup: () => mockUseAppStartup(),
}));

jest.mock("@/hooks/useStyles", () => ({
	useStyles: (factory: (theme: unknown) => unknown) =>
		factory({
			colors: {
				background: "#fff",
				primary: "#000",
				text: "#222",
			},
		}),
}));

import RootLayout from "@/app/_layout.web";

describe("RootLayout (web)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUseAppStartup.mockReturnValue({
			isHydrated: false,
			initError: null,
			runtime: "web",
			status: "running",
		});
	});

	it("shows the splash screen while the app is still hydrating", () => {
		render(<RootLayout />);

		expect(screen.getByText("Keeper")).toBeTruthy();
		expect(screen.queryByText("Drawer")).toBeNull();
	});

	it("renders the app shell once hydrated", () => {
		mockUseAppStartup.mockReturnValue({
			isHydrated: true,
			initError: null,
			runtime: "web",
			status: "ready",
		});

		render(<RootLayout />);

		expect(screen.getByText("Drawer")).toBeTruthy();
		expect(screen.getByText("Toast overlay")).toBeTruthy();
	});
});
