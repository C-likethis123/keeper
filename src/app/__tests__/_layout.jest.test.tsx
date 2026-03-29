import { appEvents } from "@/services/appEvents";
import { NoteService } from "@/services/notes/noteService";
import { render, screen, waitFor } from "@testing-library/react-native";
import type React from "react";

const mockUseAppStartup = jest.fn();
const mockUseAppKeyboardShortcuts = jest.fn();
const mockRouterPush = jest.fn();

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
	router: {
		push: (...args: unknown[]) => mockRouterPush(...args),
	},
}));

jest.mock("@/components/shared/Toast", () => ({
	ToastOverlay: () => {
		const React = require("react");
		const { Text } = require("react-native");
		return React.createElement(Text, null, "Toast overlay");
	},
}));

jest.mock("@/hooks/useAppStartup", () => ({
	useAppStartup: () => mockUseAppStartup(),
}));

jest.mock("@/hooks/useAppKeyboardShortcuts", () => ({
	useAppKeyboardShortcuts: (...args: unknown[]) =>
		mockUseAppKeyboardShortcuts(...args),
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

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: jest.fn(),
	},
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
		(NoteService.saveNote as jest.Mock).mockResolvedValue(undefined);
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

	it("wires app-level create-note and force-save shortcuts", async () => {
		mockUseAppStartup.mockReturnValue({
			isHydrated: true,
			initError: null,
			runtime: "desktop-tauri",
			status: "ready",
		});
		const emitSpy = jest.spyOn(appEvents, "emit");

		render(<RootLayout />);

		const shortcutConfig = mockUseAppKeyboardShortcuts.mock.calls[0][0] as {
			onCreateNote: () => void;
			onForceSave: () => void;
		};

		await shortcutConfig.onCreateNote();
		shortcutConfig.onForceSave();

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "",
					content: "",
					noteType: "note",
					isPinned: false,
				}),
				true,
			);
		});
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=generated-note-id");
		expect(emitSpy).toHaveBeenCalledWith("forceSave");
	});
});
