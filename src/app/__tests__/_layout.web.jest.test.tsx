import { render, screen } from "@testing-library/react-native";
import { act } from "react";
import type React from "react";

const mockUseAppStartup = jest.fn();
const mockGetTauriInvoke = jest.fn();
const mockSaveCurrentEditorBeforeBackgroundFlush = jest.fn();
const mockFlushPendingChanges = jest.fn();
const mockOnCloseRequested = jest.fn();
const mockClose = jest.fn();

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

jest.mock("react-native-safe-area-context", () => ({
	SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
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

jest.mock("@/services/storage/runtime", () => ({
	getTauriInvoke: () => mockGetTauriInvoke(),
}));

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		saveCurrentEditorBeforeBackgroundFlush: (
			...args: unknown[]
		): Promise<void> => mockSaveCurrentEditorBeforeBackgroundFlush(...args),
		flushPendingChanges: (...args: unknown[]) =>
			mockFlushPendingChanges(...args),
	},
}));

jest.mock("@tauri-apps/api/window", () => ({
	getCurrentWindow: () => ({
		onCloseRequested: (...args: unknown[]) => mockOnCloseRequested(...args),
		close: () => mockClose(),
	}),
}));

import RootLayout from "@/app/_layout.web";

describe("RootLayout (web)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockGetTauriInvoke.mockReturnValue(null);
		mockSaveCurrentEditorBeforeBackgroundFlush.mockResolvedValue(undefined);
		mockFlushPendingChanges.mockResolvedValue({
			success: true,
			didCommit: true,
			didPush: true,
			didRecover: false,
		});
		mockOnCloseRequested.mockResolvedValue(jest.fn());
		mockClose.mockResolvedValue(undefined);
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

	it("saves the editor before flushing git on Tauri window close", async () => {
		mockGetTauriInvoke.mockReturnValue(jest.fn());
		mockUseAppStartup.mockReturnValue({
			isHydrated: true,
			initError: null,
			runtime: "web",
			status: "ready",
		});

		render(<RootLayout />);

		await act(async () => {
			await Promise.resolve();
		});

		const closeHandler = mockOnCloseRequested.mock.calls[0]?.[0];
		expect(closeHandler).toEqual(expect.any(Function));
		const event = { preventDefault: jest.fn() };

		await act(async () => {
			await closeHandler(event);
		});

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(mockSaveCurrentEditorBeforeBackgroundFlush).toHaveBeenCalledTimes(1);
		expect(mockFlushPendingChanges).toHaveBeenCalledWith({
			reason: "app-background",
			timeoutMs: 5000,
		});
		expect(
			mockSaveCurrentEditorBeforeBackgroundFlush.mock.invocationCallOrder[0],
		).toBeLessThan(mockFlushPendingChanges.mock.invocationCallOrder[0]);
		expect(mockClose).toHaveBeenCalledTimes(1);
	});
});
