import NoteEditorView from "@/components/NoteEditorView";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import {
	act,
	renderRouter,
	screen,
	testRouter,
	userEvent,
	waitFor,
} from "expo-router/testing-library";
import type React from "react";
import { Text } from "react-native";

jest.useFakeTimers();

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockListNotesFallback = jest.fn();
const mockIndexListNotes = jest.fn();
const mockNavigationSetOptions = jest.fn();

let latestNavigationOptions:
	| {
			headerLeft?: () => React.ReactNode;
			headerRight?: () => React.ReactNode;
			headerTitle?: () => React.ReactNode;
	  }
	| undefined;

jest.mock("expo-router", () => {
	const actual = jest.requireActual("expo-router/build/index");

	return {
		...actual,
		useNavigation: () => ({
			setOptions: (options: typeof latestNavigationOptions) => {
				latestNavigationOptions = options;
				mockNavigationSetOptions(options);
			},
		}),
	};
});

// Use actual useAutoSave hook to test consolidation
jest.mock("@/hooks/useAutoSave", () => jest.requireActual("@/hooks/useAutoSave"));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			border: "#d0d7de",
			card: "#f9fafb",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
		},
		custom: {
			editor: {
				placeholder: "#9ca3af",
			},
		},
	}),
}));

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		MaterialIcons: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

jest.mock("react-native-webview", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		WebView: () => React.createElement(Text, null, "Mock WebView"),
	};
});

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
		listNotesFallback: (...args: unknown[]) => mockListNotesFallback(...args),
	},
}));

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		listNotes: (...args: unknown[]) => mockIndexListNotes(...args),
	},
}));

jest.mock("@/components/editor/EditorToolbar", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		EditorToolbar: () => React.createElement(Text, null, "Toolbar"),
	};
});

jest.mock("@/components/editor/HybridEditor", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		HybridEditor: () => React.createElement(Text, null, "Mock editor"),
	};
});

function makeNote(overrides?: Partial<Note>): Note {
	return {
		id: "note-1",
		title: "Draft note",
		content: "Initial body",
		lastUpdated: 1710000000000,
		isPinned: false,
		noteType: "note",
		status: null,
		...overrides,
	};
}

function renderNoteEditor(note: Note) {
	const result = renderRouter(
		{
			index: () => <Text>Home route</Text>,
			editor: () => <NoteEditorView note={note} />,
		},
		{ initialUrl: "/" },
	);
	testRouter.push("/editor");
	return result;
}

function pressHeaderBack() {
	const headerLeft = latestNavigationOptions?.headerLeft;
	if (!headerLeft) {
		throw new Error("headerLeft was not set");
	}
	const element = headerLeft() as React.ReactElement<{ onPress: () => void }>;
	act(() => {
		element.props.onPress();
	});
}

describe("NoteEditorView", () => {
	beforeEach(() => {
		mockLoadNote.mockReset();
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
		mockListNotesFallback.mockReset();
		mockIndexListNotes.mockReset();
		mockLoadNote.mockImplementation(async (id: string) => makeNote({ id }));
		mockSaveNote.mockResolvedValue(undefined);
		mockDeleteNote.mockResolvedValue(undefined);
		mockListNotesFallback.mockResolvedValue({ items: [], cursor: undefined });
		mockIndexListNotes.mockResolvedValue({ items: [], cursor: undefined });
		mockNavigationSetOptions.mockReset();
		latestNavigationOptions = undefined;
		useEditorState.getState().resetState();
		useStorageStore.setState({
			capabilities: {
				backend: "mobile-native",
			},
			initializationStatus: "ready",
			initializationError: undefined,
			contentVersion: 0,
			notesRoot: undefined,
		});
	});

	it("loads note markdown into the editor store on mount", async () => {
		const note = makeNote({ content: "# Heading" });

		const result = renderNoteEditor(note);

		await screen.findByText("Mock editor");
		await waitFor(() => {
			expect(useEditorState.getState().getContent()).toBe("# Heading");
		});
		expect(result.getPathname()).toBe("/editor");
	});

	it("defaults todo status to open when switching a note to todo and saving", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar");
		const titleInput = screen.getByPlaceholderText("Title");
		await user.clear(titleInput);
		await user.type(titleInput, "Todo My tasks");
		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: "Todo My tasks",
					noteType: "todo",
					status: "open",
				}),
				true,
			);
		});
	});

	it("does not save when pressing back without any note changes", async () => {
		const note = makeNote();
		mockLoadNote.mockResolvedValue(note);

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar");
		expect(screen.getByPlaceholderText("Title")).toHaveProp("editable", true);

		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("preserves an existing stored note type on mount instead of re-deriving it", async () => {
		const note = makeNote({
			title: "Weekly reading list",
			noteType: "resource",
		});
		mockLoadNote.mockResolvedValue(note);

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar");
		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("converts a note into a template on save when template type is selected", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar");
		const titleInput = screen.getByPlaceholderText("Title");
		await user.clear(titleInput);
		await user.type(titleInput, "Template: Weekly Review");
		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: "Template: Weekly Review",
					noteType: "template",
				}),
				true,
			);
		});
		expect(mockDeleteNote).toHaveBeenCalledWith(note.id, "note");
	});

});
