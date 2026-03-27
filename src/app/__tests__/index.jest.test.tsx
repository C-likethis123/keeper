import Index from "@/app/index";
import { NoteService } from "@/services/notes/noteService";
import { useStorageStore } from "@/stores/storageStore";
import {
	fireEvent,
	render,
	screen,
	userEvent,
	waitFor,
} from "@testing-library/react-native";
import React from "react";

const mockUseNotes = jest.fn();
const mockShowToast = jest.fn();
const mockRouterPush = jest.fn();
const mockUseFocusEffect = jest.fn();

jest.mock("@/hooks/useNotes", () => ({
	__esModule: true,
	default: (...args: unknown[]) => mockUseNotes(...args),
}));

jest.mock("@/stores/toastStore", () => ({
	useToastStore: (
		selector: (state: { showToast: typeof mockShowToast }) => unknown,
	) => selector({ showToast: mockShowToast }),
}));

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		MaterialIcons: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

jest.mock("nanoid", () => ({
	nanoid: () => "new-note-id",
}));

jest.mock("expo-router", () => ({
	Stack: {
		Screen: () => null,
	},
	router: {
		push: (...args: unknown[]) => mockRouterPush(...args),
	},
	useFocusEffect: (callback: () => void) => mockUseFocusEffect(callback),
}));

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: jest.fn(),
		deleteNote: jest.fn(),
	},
}));

jest.mock("@/components/NoteGrid", () => {
	const React = require("react");
	const { View, Text } = require("react-native");
	return {
		__esModule: true,
		default: ({
			listHeaderComponent,
			notes,
		}: {
			listHeaderComponent?: React.ReactNode;
			notes: Array<{ title: string }>;
		}) =>
			React.createElement(View, { testID: "note-grid" }, [
				React.createElement(
					React.Fragment,
					{ key: "header" },
					listHeaderComponent,
				),
				React.createElement(Text, { key: "count" }, `Notes: ${notes.length}`),
			]),
	};
});

jest.mock("@/components/shared/Loader", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: () => React.createElement(Text, null, "Loading notes"),
	};
});

jest.mock("@/components/shared/ErrorScreen", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: ({ errorMessage }: { errorMessage: string }) =>
			React.createElement(Text, null, errorMessage),
	};
});

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
			textDisabled: "#d1d5db",
			primary: "#f59e0b",
			primaryContrast: "#ffffff",
			error: "#dc2626",
			shadow: "#000000",
		},
	}),
}));

function makeUseNotesResult(
	overrides?: Partial<ReturnType<typeof mockUseNotes>>,
) {
	return {
		notes: [{ id: "note-1", title: "First note" }],
		query: "",
		noteTypeFilter: [],
		statusFilter: undefined,
		hasMore: false,
		isLoading: false,
		error: null,
		handleRefresh: jest.fn(),
		loadMoreNotes: jest.fn(),
		setQuery: jest.fn(),
		setNoteTypeFilter: jest.fn(),
		setStatusFilter: jest.fn(),
		...overrides,
	};
}

describe("Index", () => {
	beforeEach(() => {
		mockUseNotes.mockReset();
		mockShowToast.mockReset();
		mockRouterPush.mockReset();
		mockUseFocusEffect.mockReset();
		(NoteService.saveNote as jest.Mock).mockReset();
		(NoteService.saveNote as jest.Mock).mockResolvedValue(undefined);
		useStorageStore.setState({
			capabilities: {
				backend: "mobile-native",
				canSearch: true,
			},
			initializationStatus: "ready",
			initializationError: undefined,
			contentVersion: 0,
			notesRoot: undefined,
		});
	});

	it("renders the custom home header and composer", async () => {
		const handleRefresh = jest.fn();
		mockUseFocusEffect.mockImplementation((callback: () => void) => callback());
		mockUseNotes.mockReturnValue(
			makeUseNotesResult({
				handleRefresh,
			}),
		);

		render(<Index />);

		expect(await screen.findByText("Notes: 1")).toBeOnTheScreen();
		expect(screen.getByText("Keeper")).toBeOnTheScreen();
		expect(screen.getByPlaceholderText("Search")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Take a note" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Filter notes" }),
		).toBeOnTheScreen();
		expect(handleRefresh).toHaveBeenCalledTimes(1);
	});

	it("updates the search query through the header search input", async () => {
		const setQuery = jest.fn();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(
			makeUseNotesResult({
				setQuery,
			}),
		);

		render(<Index />);

		fireEvent.changeText(screen.getByPlaceholderText("Search"), "ideas");

		expect(setQuery).toHaveBeenCalledWith("ideas");
	});

	it("opens the filter dropdown and selects a note type", async () => {
		const user = userEvent.setup();
		const setNoteTypeFilter = jest.fn();
		const setStatusFilter = jest.fn();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(
			makeUseNotesResult({
				setNoteTypeFilter,
				setStatusFilter,
			}),
		);

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Filter notes" }));
		await user.press(screen.getByRole("checkbox", { name: "Journals" }));

		expect(setNoteTypeFilter).toHaveBeenCalledWith(["journal"]);
		expect(setStatusFilter).toHaveBeenCalledWith(undefined);
	});

	it("creates a blank note and routes into the editor from the quick composer", async () => {
		const user = userEvent.setup();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Take a note" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "new-note-id",
					title: "",
					content: "",
					isPinned: false,
					noteType: "note",
					lastUpdated: expect.any(Number),
				}),
				true,
			);
		});
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=new-note-id");
	});

	it("creates a todo note from the checkbox action", async () => {
		const user = userEvent.setup();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create todo" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "new-note-id",
					title: "Todo ",
					content: "",
					isPinned: false,
					noteType: "todo",
					status: "open",
					lastUpdated: expect.any(Number),
				}),
				true,
			);
		});
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=new-note-id");
	});

	it("creates a journal note from the quick composer", async () => {
		const user = userEvent.setup();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create journal" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "new-note-id",
					title: "Journal ",
					content: "",
					isPinned: false,
					noteType: "journal",
					lastUpdated: expect.any(Number),
				}),
				true,
			);
		});
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=new-note-id");
	});

	it("creates a resource note from the quick composer", async () => {
		const user = userEvent.setup();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create resource" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "new-note-id",
					title: "Resource ",
					content: "",
					isPinned: false,
					noteType: "resource",
					lastUpdated: expect.any(Number),
				}),
				true,
			);
		});
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=new-note-id");
	});

	it("creates a quick note from the composer", async () => {
		const user = userEvent.setup();
		mockUseFocusEffect.mockImplementation(() => {});
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Take a note" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "new-note-id",
					title: "",
					content: "",
					isPinned: false,
					noteType: "note",
					lastUpdated: expect.any(Number),
				}),
				true,
			);
		});
		expect(mockShowToast).not.toHaveBeenCalled();
		expect(mockRouterPush).toHaveBeenCalledWith("/editor?id=new-note-id");
	});
});
