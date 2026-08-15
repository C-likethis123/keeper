import Index from "@/app/index";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
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
const mockOpenDrawer = jest.fn();
const mockEditorFocus = jest.fn();

jest.mock("@/hooks/useNotes", () => ({
	__esModule: true,
	default: (...args: unknown[]) => mockUseNotes(...args),
}));

jest.mock("@/hooks/useAppKeyboardShortcuts", () => ({
	useAppKeyboardShortcuts: jest.fn(),
}));

jest.mock("@/services/toast", () => ({
	showToast: mockShowToast,
}));

jest.mock("@/stores/filterStore", () => ({
	useFilterStore: (
		selector: (state: {
			reset: typeof mockShowToast;
		}) => unknown,
	) => selector({ reset: mockShowToast }),
}));

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		FontAwesome: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

jest.mock("nanoid", () => ({
	nanoid: () => "new-note-id",
}));

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => {
	const React = require("react");
	return {
		Stack: {
			Screen: ({
				options,
			}: {
				options?: { header?: () => React.ReactNode };
			}) =>
				options?.header
					? React.createElement(React.Fragment, null, options.header())
					: null,
		},
		router: {
			push: (...args: unknown[]) => mockRouterPush(...args),
		},
		useNavigation: () => ({
			openDrawer: (...args: unknown[]) => mockOpenDrawer(...args),
		}),
	};
});

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: jest.fn(),
		deleteNote: jest.fn(),
	},
}));

jest.mock("@/services/notes/clusterService", () => ({
	clusterAddNote: jest.fn(),
	clusterDelete: jest.fn(),
	clusterRemoveNote: jest.fn(),
	clusterRename: jest.fn(),
	importClustersFromFile: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/services/notes/clusterFeedbackService", () => ({
	logFeedback: jest.fn(),
}));

jest.mock("@/components/NoteGrid", () => {
	const React = require("react");
	const { View, Text } = require("react-native");
	return {
		__esModule: true,
		default: ({
			listHeaderComponent,
			notes,
			refreshing,
			isLoadingMore,
		}: {
			listHeaderComponent?: React.ReactNode;
			notes: Array<{ title: string }>;
			refreshing: boolean;
			isLoadingMore: boolean;
		}) =>
			React.createElement(View, { testID: "note-grid" }, [
				React.createElement(
					React.Fragment,
					{ key: "header" },
					listHeaderComponent,
				),
				React.createElement(Text, { key: "count" }, `Notes: ${notes.length}`),
				React.createElement(
					Text,
					{ key: "refreshing" },
					`Refreshing: ${refreshing}`,
				),
				React.createElement(
					Text,
					{ key: "loading-more" },
					`Loading more: ${isLoadingMore}`,
				),
			]),
	};
});

jest.mock("@/components/editor/lexical/LexicalMarkdownEditor", () => {
	const React = require("react");
	const { TextInput } = require("react-native");
	return {
		__esModule: true,
		default: ({
			accessibilityLabel,
			command,
			markdown,
			onMarkdownChange,
		}: {
			accessibilityLabel: string;
			command?: { type: string };
			markdown: string;
			onMarkdownChange: (markdown: string) => void;
		}) => {
			React.useEffect(() => {
				if (command?.type === "focusEditor") mockEditorFocus();
			}, [command]);
			return React.createElement(TextInput, {
				accessibilityLabel,
				multiline: true,
				value: markdown,
				onChangeText: onMarkdownChange,
			});
		},
	};
});

jest.mock("@/components/moc/AddNoteToClusterModal", () => {
	const React = require("react");
	return {
		__esModule: true,
		default: () => React.createElement(React.Fragment, null),
	};
});

jest.mock("@/components/moc/RenameClusterModal", () => {
	const React = require("react");
	return {
		__esModule: true,
		default: () => React.createElement(React.Fragment, null),
	};
});

jest.mock("@/components/shared/StartupScreen", () => {
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
		default: ({ error }: { error: Error }) =>
			React.createElement(Text, null, error.message),
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
		sections: [],
		query: "",
		noteTypeFilter: undefined,
		statusFilter: undefined,
		hasMore: false,
		isRefreshing: false,
		isLoadingMore: false,
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
		mockOpenDrawer.mockReset();
		(NoteService.saveNote as jest.Mock).mockReset();
		(NoteService.saveNote as jest.Mock).mockResolvedValue(undefined);
		useStorageStore.setState({
			initializationStatus: "ready",
			initializationError: undefined,
			contentVersion: 0,
		});
	});

	it("renders the note grid without a second loading fallback", () => {
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		expect(screen.getByText("Notes: 1")).toBeOnTheScreen();
		expect(screen.queryByText("Loading notes")).not.toBeOnTheScreen();
		expect(screen.getByPlaceholderText("Search")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Take a note" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Open filters" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Open suggested MOCs" }),
		).toBeOnTheScreen();
	});

	it("expands the quick composer without leaving the notes screen", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);
		await user.press(screen.getByRole("button", { name: "Take a note" }));

		expect(screen.getByTestId("home-quick-composer-card")).toHaveStyle({
			maxWidth: 860,
			minHeight: 220,
		});
		expect(screen.getByText("Notes: 1")).toBeOnTheScreen();
	});

	it("keeps refresh and pagination loading states independent", () => {
		mockUseNotes.mockReturnValue(
			makeUseNotesResult({ isRefreshing: true, isLoadingMore: false }),
		);

		render(<Index />);

		expect(screen.getByText("Refreshing: true")).toBeOnTheScreen();
		expect(screen.getByText("Loading more: false")).toBeOnTheScreen();
	});

	it("updates the search query through the header search input", async () => {
		const setQuery = jest.fn();
		mockUseNotes.mockReturnValue(
			makeUseNotesResult({
				setQuery,
			}),
		);

		render(<Index />);

		fireEvent.changeText(screen.getByPlaceholderText("Search"), "ideas");

		expect(setQuery).toHaveBeenCalledWith("ideas");
	});

	it("opens the filter panel from the hamburger button", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Open filters" }));

		expect(mockOpenDrawer).toHaveBeenCalled();
	});

	it("opens the dedicated suggested MOCs page from the header", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(
			screen.getByRole("button", { name: "Open suggested MOCs" }),
		);

		expect(mockRouterPush).toHaveBeenCalledWith("/suggested-mocs");
	});

	it("expands the quick composer without leaving home", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Take a note" }));

		expect(screen.getByLabelText("Note title")).toBeOnTheScreen();
		expect(screen.getByLabelText("Note content")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Pin note" })).toBeOnTheScreen();
		expect(mockRouterPush).not.toHaveBeenCalled();

		fireEvent(screen.getByLabelText("Note title"), "submitEditing");
		expect(mockEditorFocus).toHaveBeenCalledTimes(1);
	});

	it("registers home route shortcuts for search focus and note creation", () => {
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		expect(useAppKeyboardShortcuts).toHaveBeenCalledWith({
			onFocusSearch: expect.any(Function),
			onCreateNote: expect.any(Function),
		});
	});

	it("creates a todo note from the checkbox action", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create todo" }));

		await waitFor(() => {
			expect(mockRouterPush).toHaveBeenCalledWith({
				pathname: "/editor",
				params: {
					id: "new-note-id",
					isNew: "true",
					title: "TODO:",
					noteType: "todo",
				},
			});
		});
		expect(NoteService.saveNote).not.toHaveBeenCalled();
	});

	it("creates a journal note from the quick composer", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create journal" }));

		await waitFor(() => {
			expect(mockRouterPush).toHaveBeenCalledWith({
				pathname: "/editor",
				params: {
					id: "new-note-id",
					isNew: "true",
					title: "Journal: ",
					noteType: "journal",
				},
			});
		});
		expect(NoteService.saveNote).not.toHaveBeenCalled();
	});

	it("creates a resource note from the quick composer", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Create resource" }));

		await waitFor(() => {
			expect(mockRouterPush).toHaveBeenCalledWith({
				pathname: "/editor",
				params: {
					id: "new-note-id",
					isNew: "true",
					title: "Source: ",
					noteType: "resource",
				},
			});
		});
		expect(NoteService.saveNote).not.toHaveBeenCalled();
	});

	it("creates a quick note from the composer", async () => {
		const user = userEvent.setup();
		const notesResult = makeUseNotesResult();
		mockUseNotes.mockReturnValue(notesResult);

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Take a note" }));
		await user.type(screen.getByLabelText("Note title"), "Trip ideas");
		await user.type(screen.getByLabelText("Note content"), "Visit Kyoto");
		await user.press(screen.getByRole("button", { name: "Pin note" }));
		await user.press(screen.getByRole("button", { name: "Close note" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				{
					id: "new-note-id",
					title: "Trip ideas",
					content: "Visit Kyoto",
					isPinned: true,
					noteType: "note",
				},
				true,
			);
		});
		expect(notesResult.handleRefresh).toHaveBeenCalled();
		expect(mockRouterPush).not.toHaveBeenCalled();
	});

	it("creates a quick note when only content is present", async () => {
		const user = userEvent.setup();
		mockUseNotes.mockReturnValue(makeUseNotesResult());

		render(<Index />);

		await user.press(screen.getByRole("button", { name: "Take a note" }));
		await user.type(screen.getByLabelText("Note content"), "Content only");
		await user.press(screen.getByRole("button", { name: "Close note" }));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				{
					id: "new-note-id",
					title: "",
					content: "Content only",
					isPinned: false,
					noteType: "note",
				},
				true,
			);
		});
	});
});
