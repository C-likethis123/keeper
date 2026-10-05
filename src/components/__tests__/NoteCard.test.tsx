import { vi } from "vitest";
import NoteCard from "@/components/NoteCard";
import type { Note } from "@/services/notes/types";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/components/shared/Icons", () => ({
	FontAwesome: ({ name }: { name: string }) => name,
}));

vi.mock("@/hooks/useExtendedTheme", () => ({
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
		const onOpen = vi.fn();
		render(
			<NoteCard
				note={makeNote()}
				onOpen={onOpen}
				onDelete={vi.fn()}
				onPinToggle={vi.fn()}
			/>,
		);

		const card = screen.getByRole("button", {
			name: "Open note First note",
		});
		fireEvent.click(card);

		expect(onOpen).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1" }),
		);
	});

	it("deletes without opening the note when delete is pressed", () => {
		const onDelete = vi.fn();

		render(
			<NoteCard
				note={makeNote()}
				onOpen={vi.fn()}
				onDelete={onDelete}
				onPinToggle={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByLabelText("Delete note"));

		expect(onDelete).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1" }),
		);
	});

	it("toggles pin without opening the note when pin is pressed", () => {
		const onPinToggle = vi.fn();

		render(
			<NoteCard
				note={makeNote()}
				onOpen={vi.fn()}
				onDelete={vi.fn()}
				onPinToggle={onPinToggle}
			/>,
		);

		fireEvent.click(screen.getByLabelText("Pin note"));

		expect(onPinToggle).toHaveBeenCalledWith(
			expect.objectContaining({ id: "note-1", isPinned: true }),
		);
	});
});
