import {
	WikiLinkProvider,
	useWikiLinkContext,
} from "@/components/editor/wikilinks/WikiLinkContext";
import { WikiLinkModal } from "@/components/editor/wikilinks/WikiLinkModal";
import { NoteService } from "@/services/notes/noteService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import {
	fireEvent,
	renderAsync,
	screen,
	userEvent,
	waitFor,
} from "@testing-library/react-native";
import React, { useEffect } from "react";

const mockUpdateBlockContent = jest.fn();
const mockSetSelection = jest.fn();

const mockDocument = {
	blocks: [{ content: "[[", type: "paragraph", attributes: {} }],
	version: 1,
};

jest.mock("@/stores/editorStore", () => {
	const getState = () => ({
		selection: { blockIndex: 0, offset: 5 },
		document: mockDocument,
		setSelection: mockSetSelection,
		updateBlockContent: mockUpdateBlockContent,
	});

	const useEditorState = (
		selector: (s: ReturnType<typeof getState>) => unknown,
	) => selector(getState());
	useEditorState.getState = getState;

	return { useEditorState };
});

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		listNotes: jest.fn(),
	},
}));

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: jest.fn(),
	},
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			card: "#f9fafb",
			text: "#111827",
			border: "#d0d7de",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			primaryPressed: "#1d4ed8",
			shadow: "#000000",
		},
		custom: { editor: { placeholder: "#9ca3af" } },
		typography: { body: { fontSize: 16 } },
	}),
}));

jest.mock("@/components/shared/Loader", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: () => React.createElement(Text, null, "Loading"),
	};
});

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		MaterialIcons: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

/** Activates the wikilink modal immediately on mount. */
function Activator({
	blockIndex = 0,
	offset = 0,
	initialQuery = "",
}: {
	blockIndex?: number;
	offset?: number;
	initialQuery?: string;
}) {
	const { handleTriggerStart } = useWikiLinkContext();
	// biome-ignore lint/correctness/useExhaustiveDependencies: test helper — runs once on mount
	useEffect(() => {
		handleTriggerStart(blockIndex, offset, initialQuery);
	}, []);
	return null;
}

function renderModal() {
	return renderAsync(
		<WikiLinkProvider>
			<Activator />
			<WikiLinkModal />
		</WikiLinkProvider>,
	);
}

function createUser() {
	return userEvent.setup();
}

describe("WikiLinkModal", () => {
	beforeEach(() => {
		mockUpdateBlockContent.mockReset();
		mockSetSelection.mockReset();
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({ items: [] });
		jest.mocked(NoteService.saveNote).mockResolvedValue({
			id: "generated-note-id",
			title: "New Note",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "note",
		});
	});

	it("shows the search input when the modal is active", async () => {
		await renderModal();
		expect(
			screen.getByPlaceholderText("Search or create notes..."),
		).toBeOnTheScreen();
	});

	it("searches for notes as the user types", async () => {
		const user = createUser();
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({
			items: [
				{
					noteId: "note-1",
					title: "Meeting Notes",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		await renderModal();
		await user.type(
			screen.getByPlaceholderText("Search or create notes..."),
			"meet",
		);

		await waitFor(() => {
			expect(NotesIndexService.listNotes).toHaveBeenCalledWith(
				"meet",
				expect.any(Number),
				0,
			);
		});
		expect(await screen.findByText("Meeting Notes")).toBeOnTheScreen();
	});

	it("shows a create option when no exact title match exists", async () => {
		const user = createUser();
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({ items: [] });

		await renderModal();
		await user.type(
			screen.getByPlaceholderText("Search or create notes..."),
			"new idea",
		);

		expect(await screen.findByText('Create "new idea"')).toBeOnTheScreen();
	});

	it("does not show a create option when an exact title match exists", async () => {
		const user = createUser();
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({
			items: [
				{
					noteId: "note-x",
					title: "Exact Match",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		await renderModal();
		await user.type(
			screen.getByPlaceholderText("Search or create notes..."),
			"exact match",
		);

		await waitFor(() => {
			expect(screen.queryByText(/Create/)).not.toBeOnTheScreen();
		});
	});

	it("submits the keyboard-selected result", async () => {
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({
			items: [
				{
					noteId: "n1",
					title: "Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
				{
					noteId: "n2",
					title: "Beta",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		await renderModal();
		expect(await screen.findByText("Alpha")).toBeOnTheScreen();

		const input = screen.getByPlaceholderText("Search or create notes...");

		fireEvent(input, "keyPress", { nativeEvent: { key: "ArrowDown" } });
		fireEvent(input, "submitEditing");

		await waitFor(() => {
			expect(mockUpdateBlockContent).toHaveBeenCalledWith(
				0,
				expect.stringContaining("[[Beta]]"),
				expect.any(Number),
			);
		});
	});

	it("cancels and closes the modal on Escape", async () => {
		await renderModal();

		const input = screen.getByPlaceholderText("Search or create notes...");
		fireEvent(input, "keyPress", { nativeEvent: { key: "Escape" } });

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Search or create notes..."),
			).not.toBeOnTheScreen();
		});
	});

	it("cancels on Backspace when the input is empty", async () => {
		await renderModal();

		const input = screen.getByPlaceholderText("Search or create notes...");
		fireEvent(input, "keyPress", { nativeEvent: { key: "Backspace" } });

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Search or create notes..."),
			).not.toBeOnTheScreen();
		});
	});

	it("inserts the wiki link when an existing result is selected", async () => {
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({
			items: [
				{
					noteId: "note-abc",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		await renderModal();
		expect(await screen.findByText("Project Alpha")).toBeOnTheScreen();

		const user = createUser();
		await user.press(screen.getByText("Project Alpha"));

		expect(mockUpdateBlockContent).toHaveBeenCalledWith(
			0,
			expect.stringContaining("[[Project Alpha]]"),
			expect.any(Number),
		);
		expect(NoteService.saveNote).not.toHaveBeenCalled();
	});

	it("creates a stub note when a create result is selected", async () => {
		jest.mocked(NotesIndexService.listNotes).mockResolvedValue({ items: [] });
		const user = createUser();

		await renderModal();
		await user.type(
			screen.getByPlaceholderText("Search or create notes..."),
			"Brand New",
		);

		expect(await screen.findByText('Create "Brand New"')).toBeOnTheScreen();

		await user.press(screen.getByText('Create "Brand New"'));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Brand New",
					content: "",
					isPinned: false,
					noteType: "note",
				}),
				true,
			);
		});
	});
});
