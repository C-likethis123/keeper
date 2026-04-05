import NoteCard from "@/components/NoteCard";
import type { Note } from "@/services/notes/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: mockPush,
	}),
}));

jest.mock("@expo/vector-icons", () => ({
	FontAwesome: ({ name }: { name: string }) => name,
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			card: "#f9fafb",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
			primary: "#2563eb",
		},
	}),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: "note-1",
		title: "First note",
		content: "Body text",
		lastUpdated: "2026-04-05T10:00:00.000Z",
		isPinned: false,
		noteType: "note",
		status: undefined,
		createdAt: "2026-04-05T09:00:00.000Z",
		path: "First note.md",
		attachments: [],
		...overrides,
	};
}

describe("NoteCard", () => {
	beforeEach(() => {
		mockPush.mockReset();
	});

	it("opens the note when the card is pressed", () => {
		render(
			<NoteCard
				note={makeNote()}
				onDelete={jest.fn()}
				onPinToggle={jest.fn()}
			/>,
		);

		fireEvent.press(
			screen.getByRole("button", { name: "Open note First note" }),
		);

		expect(mockPush).toHaveBeenCalledWith("/editor?id=note-1");
	});

	it("deletes without opening the note when delete is pressed", () => {
		const onDelete = jest.fn();

		render(
			<NoteCard
				note={makeNote()}
				onDelete={onDelete}
				onPinToggle={jest.fn()}
			/>,
		);

		fireEvent.press(screen.getByLabelText("Delete note"));

		expect(onDelete).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1" }),
		);
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("toggles pin without opening the note when pin is pressed", () => {
		const onPinToggle = jest.fn();

		render(
			<NoteCard
				note={makeNote()}
				onDelete={jest.fn()}
				onPinToggle={onPinToggle}
			/>,
		);

		fireEvent.press(screen.getByLabelText("Pin note"));

		expect(onPinToggle).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1", isPinned: true }),
		);
		expect(mockPush).not.toHaveBeenCalled();
	});
});
