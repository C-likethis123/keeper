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

const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockSaveTemplate = jest.fn();
const mockDeleteTemplate = jest.fn();
const mockListTemplates = jest.fn();
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

jest.mock("@/hooks/useAutoSave", () => ({
	useAutoSave: () => ({
		status: "idle",
	}),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			border: "#d0d7de",
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

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
	},
}));

jest.mock("@/services/notes/templateService", () => ({
	TemplateService: {
		saveTemplate: (...args: unknown[]) => mockSaveTemplate(...args),
		deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
		listTemplates: (...args: unknown[]) => mockListTemplates(...args),
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
		status: undefined,
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
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
		mockSaveTemplate.mockReset();
		mockDeleteTemplate.mockReset();
		mockListTemplates.mockReset();
		mockSaveNote.mockResolvedValue(undefined);
		mockDeleteNote.mockResolvedValue(undefined);
		mockSaveTemplate.mockResolvedValue(undefined);
		mockDeleteTemplate.mockResolvedValue(undefined);
		mockListTemplates.mockResolvedValue([]);
		mockNavigationSetOptions.mockReset();
		latestNavigationOptions = undefined;
		useEditorState.getState().resetState();
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

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar enabled");
		await user.press(screen.getByText("Todo"));
		await screen.findByText("Status");
		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: note.title,
					noteType: "todo",
					status: "open",
				}),
				false,
			);
		});
	});

	it("saves and navigates back when pressing the header back action", async () => {
		const note = makeNote();

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar enabled");
		expect(screen.getByPlaceholderText("Title").props.editable).toBe(true);

		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: note.id,
				title: note.title,
			}),
			false,
		);
	});

	it("converts a note into a template on save when template type is selected", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar enabled");
		await user.press(screen.getAllByText("Template")[0]);
		await waitFor(() => {
			expect(latestNavigationOptions?.headerLeft).toBeDefined();
		});
		pressHeaderBack();

		await waitFor(() => {
			expect(mockSaveTemplate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: note.title,
					noteType: "template",
				}),
				true,
			);
		});
		expect(mockDeleteNote).toHaveBeenCalledWith(note.id);
	});
});
