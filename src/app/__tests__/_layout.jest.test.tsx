import { render, screen } from "@testing-library/react-native";
import type React from "react";

const mockUseAppStartup = jest.fn();

jest.mock("@react-navigation/native", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
	DarkTheme: { colors: {} },
	LightTheme: { colors: {} },
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

jest.mock("expo-router", () => ({
	Stack: () => {
		const React = require("react");
		const { Text } = require("react-native");
		return React.createElement(Text, null, "Stack");
	},
}));

jest.mock("@/components/shared/Toast", () => ({
	ToastOverlay: () => {
		const React = require("react");
		const { Text } = require("react-native");
		return React.createElement(Text, null, "Toast overlay");
	},
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

import RootLayout from "@/app/_layout";

describe("RootLayout", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUseAppStartup.mockReturnValue({
			isHydrated: false,
			initError: null,
			runtime: "desktop-tauri",
			status: "running",
		});
	});

	it("shows the splash screen while the app is still hydrating", () => {
		render(<RootLayout />);

		expect(screen.getByText("Keeper")).toBeTruthy();
		expect(screen.queryByText("Stack")).toBeNull();
	});

	it("shows the initialization error once startup fails", () => {
		mockUseAppStartup.mockReturnValue({
			isHydrated: true,
			initError: "Storage is unavailable",
			runtime: "desktop-tauri",
			status: "error",
		});

		render(<RootLayout />);

		expect(screen.getByText("Storage is unavailable")).toBeTruthy();
		expect(screen.queryByText("Stack")).toBeNull();
	});

	it("renders the app shell once hydrated", () => {
		mockUseAppStartup.mockReturnValue({
			isHydrated: true,
			initError: null,
			runtime: "desktop-tauri",
			status: "ready",
		});

		render(<RootLayout />);

		expect(screen.getByText("Stack")).toBeTruthy();
		expect(screen.getByText("Toast overlay")).toBeTruthy();
	});
});
