import NoteEditorScreen from "@/app/editor";
import type { Note } from "@/services/notes/types";
import { renderRouter, screen } from "expo-router/testing-library";
import React from "react";

const mockUseLoadNote = jest.fn();

jest.mock("@/hooks/useLoadNote", () => ({
	useLoadNote: (...args: unknown[]) => mockUseLoadNote(...args),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			border: "#d0d7de",
			text: "#111827",
		},
	}),
}));

jest.mock("@/components/shared/Loader", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: () => React.createElement(Text, null, "Loading note"),
	};
});

jest.mock("@/components/shared/ErrorScreen", () => {
	const React = require("react");
	const { Text, View } = require("react-native");
	return {
		__esModule: true,
		default: ({ errorMessage }: { errorMessage: string }) =>
			React.createElement(View, null, [
				React.createElement(Text, { key: "label" }, "Error screen"),
				React.createElement(Text, { key: "message" }, errorMessage),
			]),
	};
});

jest.mock("@/components/NoteEditorView", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: ({ note }: { note: Note }) =>
			React.createElement(Text, null, `Loaded note: ${note.title}`),
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

describe("NoteEditorScreen", () => {
	beforeEach(() => {
		mockUseLoadNote.mockReset();
	});

	it("shows the loading state while the note request is pending", async () => {
		mockUseLoadNote.mockReturnValue({
			isLoading: true,
			error: null,
			note: null,
		});

		const result = renderRouter(
			{
				index: () => null,
				editor: NoteEditorScreen,
			},
			{ initialUrl: "/editor?id=note-1" },
		);

		expect(await screen.findByText("Loading note")).toBeTruthy();
		expect(mockUseLoadNote).toHaveBeenCalledWith("note-1");
		expect(result.getPathname()).toBe("/editor");
		expect(result.getSearchParams()).toEqual({ id: "note-1" });
	});

	it("shows the error screen when loading fails", async () => {
		mockUseLoadNote.mockReturnValue({
			isLoading: false,
			error: "Storage is unavailable",
			note: null,
		});

		const result = renderRouter(
			{
				index: () => null,
				editor: NoteEditorScreen,
			},
			{ initialUrl: "/editor?id=note-1" },
		);

		expect(await screen.findByText("Error screen")).toBeTruthy();
		expect(screen.getByText("Storage is unavailable")).toBeTruthy();
	});

	it("shows the fallback not-found message when no note is returned", async () => {
		mockUseLoadNote.mockReturnValue({
			isLoading: false,
			error: null,
			note: null,
		});

		const result = renderRouter(
			{
				index: () => null,
				editor: NoteEditorScreen,
			},
			{ initialUrl: "/editor?id=note-1" },
		);

		expect(await screen.findByText("Note not found")).toBeTruthy();
	});

	it("renders the note editor once the note loads", async () => {
		mockUseLoadNote.mockReturnValue({
			isLoading: false,
			error: null,
			note: makeNote({ title: "Loaded draft" }),
		});

		const result = renderRouter(
			{
				index: () => null,
				editor: NoteEditorScreen,
			},
			{ initialUrl: "/editor?id=note-1" },
		);

		expect(await screen.findByText("Loaded note: Loaded draft")).toBeTruthy();
		expect(result.getPathname()).toBe("/editor");
	});
});
