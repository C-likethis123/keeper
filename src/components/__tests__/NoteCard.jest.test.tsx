import NoteCard from "@/components/NoteCard";
import type { Note } from "@/services/notes/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("@/components/shared/Icons", () => ({
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
		lastUpdated: Date.parse("2026-04-05T10:00:00.000Z"),
		isPinned: false,
		noteType: "note",
		status: undefined,
		createdAt: Date.parse("2026-04-05T09:00:00.000Z"),
		...overrides,
	};
}

describe("NoteCard", () => {
	beforeEach(() => {});

	it("opens the note when the card is pressed", () => {
		const onOpen = jest.fn();
		render(
			<NoteCard
				note={makeNote()}
				onOpen={onOpen}
				onDelete={jest.fn()}
				onPinToggle={jest.fn()}
			/>,
		);

		const card = screen.getByRole("button", {
			name: "Open note First note",
		});
		fireEvent(card, "click");

		expect(onOpen).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1" }),
		);
	});

	it("deletes without opening the note when delete is pressed", () => {
		const onDelete = jest.fn();

		render(
			<NoteCard
				note={makeNote()}
				onOpen={jest.fn()}
				onDelete={onDelete}
				onPinToggle={jest.fn()}
			/>,
		);

		fireEvent.press(screen.getByLabelText("Delete note"));

		expect(onDelete).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1" }),
		);
	});

	it("toggles pin without opening the note when pin is pressed", () => {
		const onPinToggle = jest.fn();

		render(
			<NoteCard
				note={makeNote()}
				onOpen={jest.fn()}
				onDelete={jest.fn()}
				onPinToggle={onPinToggle}
			/>,
		);

		fireEvent.press(screen.getByLabelText("Pin note"));

		expect(onPinToggle).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1", isPinned: true }),
		);
	});
});
