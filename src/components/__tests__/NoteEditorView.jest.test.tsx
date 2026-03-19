import NoteEditorView from "@/components/NoteEditorView";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useStorageStore } from "@/stores/storageStore";
import {
	render,
	screen,
	userEvent,
	waitFor,
} from "@testing-library/react-native";
import React from "react";

const mockRouterBack = jest.fn();
const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();

// Expo Router's testing-library docs were reviewed here, but the current Jest
// stack in this repo fails to import `expo-router/testing-library` because its
// matcher setup reaches for `expect/build/matchers`. Keep this focused mock
// until the router test stack is upgraded.
jest.mock("expo-router", () => {
	const React = require("react");
	const { View } = require("react-native");

	return {
		useRouter: () => ({
			back: mockRouterBack,
		}),
		Stack: {
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

describe("NoteEditorView", () => {
	beforeEach(() => {
		mockRouterBack.mockReset();
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

		render(<NoteEditorView note={note} />);

		await screen.findByText("Mock editor");
		await waitFor(() => {
			expect(useEditorState.getState().getContent()).toBe("# Heading");
		});
	});

	it("defaults todo status to open when switching a note to todo and saving", async () => {
		const user = userEvent.setup();
		const note = makeNote();

		render(<NoteEditorView note={note} />);

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
		expect(mockRouterBack).toHaveBeenCalledTimes(1);
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

		render(<NoteEditorView note={note} />);

		await screen.findByText("Toolbar disabled");
		expect(screen.getByPlaceholderText("Title").props.editable).toBe(false);

		await user.press(screen.getByText("arrow-back"));

		await waitFor(() => {
			expect(mockRouterBack).toHaveBeenCalledTimes(1);
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});
});
