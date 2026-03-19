import NoteEditorView from "@/components/NoteEditorView";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import {
	renderRouter,
	screen,
	testRouter,
	userEvent,
	waitFor,
} from "expo-router/testing-library";
import React from "react";
import { Text } from "react-native";

const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();

jest.mock("expo-router", () => {
	const actual = jest.requireActual("expo-router/build/index");
	const React = require("react");
	const { View } = require("react-native");

	return {
		...actual,
		Stack: {
			...actual.Stack,
			Screen: ({
				options,
			}: {
				options?: {
					headerLeft?: () => React.ReactNode;
					headerRight?: () => React.ReactNode;
					headerTitle?: () => React.ReactNode;
				};
			}) =>
				React.createElement(View, { testID: "mock-stack-screen" }, [
					React.createElement(
						View,
						{ key: "left", testID: "mock-header-left" },
						options?.headerLeft?.() ?? null,
					),
					React.createElement(
						View,
						{ key: "title", testID: "mock-header-title" },
						options?.headerTitle?.() ?? null,
					),
					React.createElement(
						View,
						{ key: "right", testID: "mock-header-right" },
						options?.headerRight?.() ?? null,
					),
				]),
		},
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

jest.mock("@/components/editor/EditorToolbar", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		EditorToolbar: ({ disabled }: { disabled: boolean }) =>
			React.createElement(
				Text,
				null,
				disabled ? "Toolbar disabled" : "Toolbar enabled",
			),
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

describe("NoteEditorView", () => {
	beforeEach(() => {
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
		mockSaveNote.mockResolvedValue(undefined);
		mockDeleteNote.mockResolvedValue(undefined);
		useEditorState.getState().resetState();
		useStorageStore.setState({
			capabilities: {
				backend: "mobile-native",
				canWrite: true,
				canSearch: true,
			},
			initializationStatus: "ready",
			contentVersion: 0,
			notesRoot: undefined,
		});
	});

	it("loads note markdown into the editor store on mount", async () => {
		const note = makeNote({ content: "# Heading" });

		renderNoteEditor(note);

		await screen.findByText("Mock editor");
		await waitFor(() => {
			expect(useEditorState.getState().getContent()).toBe("# Heading");
		});
		expect(screen).toHavePathname("/editor");
	});

	it("defaults todo status to open when switching a note to todo and saving", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		renderNoteEditor(note);

		await screen.findByText("Toolbar enabled");
		await user.press(screen.getByText("Todo"));
		await screen.findByText("Status");
		await user.press(screen.getByText("arrow-back"));

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: note.id,
					title: note.title,
					noteType: "todo",
					status: "open",
				}),
			);
		});
		expect(screen).toHavePathname("/");
	});

	it("skips saves in read-only mode and only navigates back", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		useStorageStore.setState({
			capabilities: {
				backend: "mobile-native",
				canWrite: false,
				canSearch: false,
				reason: "Read-only mode",
			},
			initializationStatus: "failed",
		});

		renderNoteEditor(note);

		await screen.findByText("Toolbar disabled");
		expect(screen.getByPlaceholderText("Title").props.editable).toBe(false);

		await user.press(screen.getByText("arrow-back"));

		await waitFor(() => {
			expect(screen).toHavePathname("/");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});
});
