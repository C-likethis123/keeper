import NoteEditorView from "@/components/NoteEditorView";
import { SaveIndicator } from "@/components/SaveIndicator";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import {
	act,
	fireEvent,
	renderRouter,
	screen,
	testRouter,
	userEvent,
	waitFor,
} from "expo-router/testing-library";
import React from "react";
import { Text, TextInput } from "react-native";

jest.useFakeTimers();

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockIndexListNotes = jest.fn();
const mockNavigationSetOptions = jest.fn();

let latestNavigationOptions:
	| {
			headerLeft?: () => React.ReactNode;
			headerRight?: () => React.ReactNode;
			headerTitle?: () => React.ReactNode;
			headerTitleContainerStyle?: unknown;
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

jest.mock("react-native-safe-area-context", () => {
	const actual = jest.requireActual("react-native-safe-area-context");
	return {
		...actual,
		useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
	const { Pressable, Text } = require("react-native");
	return {
		HybridEditor: ({
			onInsertTemplateCommand,
		}: {
			onInsertTemplateCommand?: () => void;
		}) =>
			React.createElement(
				React.Fragment,
				null,
				React.createElement(Text, null, "Mock editor"),
				React.createElement(
					Pressable,
					{
						onPress: onInsertTemplateCommand,
						accessibilityRole: "button",
					},
					React.createElement(Text, null, "Trigger insert template"),
				),
			),
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
	act(() => {
		fireEvent.press(screen.getByLabelText("Back"));
	});
}

function findElementByType(
	node: React.ReactNode,
	type: unknown,
): React.ReactElement<object> | null {
	if (
		node == null ||
		typeof node === "string" ||
		typeof node === "number" ||
		typeof node === "boolean" ||
		typeof node === "bigint"
	) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const result = findElementByType(child, type);
			if (result) {
				return result;
			}
		}
		return null;
	}
	if (!React.isValidElement(node)) {
		return null;
	}
	const element = node as React.ReactElement<{ children?: React.ReactNode }>;
	if (element.type === type) {
		return element as React.ReactElement<object>;
	}
	const children = element.props.children;
	if (!children) {
		return null;
	}
	return findElementByType(children, type);
}

function getHeaderTitleInput() {
	return screen.getByPlaceholderText("Title") as React.ReactElement<{
		onChangeText: (value: string) => void;
		value: string;
		placeholder?: string;
		editable?: boolean;
	}>;
}

describe("NoteEditorView", () => {
	beforeEach(() => {
		mockLoadNote.mockReset();
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
		mockIndexListNotes.mockReset();
		mockLoadNote.mockImplementation(async (id: string) => makeNote({ id }));
		mockSaveNote.mockResolvedValue(undefined);
		mockDeleteNote.mockResolvedValue(undefined);
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
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar");
		act(() => {
			getHeaderTitleInput().props.onChangeText("Todo My tasks");
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
				false,
			);
		});
	});

	it("does not save when pressing back without any note changes", async () => {
		const note = makeNote();
		mockLoadNote.mockResolvedValue(note);

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar");
		expect(getHeaderTitleInput().props.editable).toBe(true);

		pressHeaderBack();

		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("forces a save before navigating back when the title changes", async () => {
		const note = makeNote();

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar");
		act(() => {
			getHeaderTitleInput().props.onChangeText("Renamed note");
		});

		pressHeaderBack();

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: "Renamed note",
					noteType: "note",
				}),
				false,
			);
		});
		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
	});

	it("preserves an existing stored note type on mount instead of re-deriving it", async () => {
		const note = makeNote({
			title: "Weekly reading list",
			noteType: "resource",
		});
		mockLoadNote.mockResolvedValue(note);

		const result = renderNoteEditor(note);

		await screen.findByText("Toolbar");
		pressHeaderBack();

		await waitFor(() => {
			expect(result.getPathname()).toBe("/");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("converts a note into a template on save when template type is selected", async () => {
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar");
		act(() => {
			getHeaderTitleInput().props.onChangeText("Template: Weekly Review");
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

	it("opens the template modal when the editor requests insert template", async () => {
		const user = userEvent.setup();
		const note = makeNote();
		mockIndexListNotes.mockResolvedValue({
			items: [
				{
					noteId: "template-1",
					title: "Daily template",
					summary: "Morning checklist",
					isPinned: false,
					updatedAt: 1,
					noteType: "template",
					status: null,
				},
			],
			cursor: undefined,
		});

		renderNoteEditor(note);

		await screen.findByText("Mock editor");
		await user.press(screen.getByText("Trigger insert template"));

		await screen.findByText("Choose template");
		expect(mockIndexListNotes).toHaveBeenCalledWith("", 100, 0, {
			noteTypes: ["template"],
		});
		expect(screen.getByText("Daily template")).toBeTruthy();
	});

	it("renders the note title input in the navigation header and keeps save status on the left", async () => {
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar");

		const titleInput = getHeaderTitleInput();
		expect(titleInput.props.placeholder).toBe("Title");
		expect(titleInput.props.value).toBe(note.title);
		expect(mockNavigationSetOptions).toHaveBeenCalledWith(
			expect.objectContaining({ headerShown: false }),
		);

		act(() => {
			titleInput.props.onChangeText("Renamed note");
		});

		await waitFor(() => {
			expect(getHeaderTitleInput().props.value).toBe("Renamed note");
		});
		expect(screen.getByLabelText("Back")).toBeTruthy();
		expect(screen.getByLabelText("Pin note")).toBeTruthy();
		expect(screen.getByLabelText("Delete note")).toBeTruthy();
	});
});
