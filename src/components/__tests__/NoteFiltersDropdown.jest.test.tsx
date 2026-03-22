import NoteFiltersDropdown from "@/components/NoteFiltersDropdown";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { render, screen, userEvent } from "@testing-library/react-native";
import React, { useState } from "react";

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		MaterialIcons: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

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
			primaryContrast: "#ffffff",
			shadow: "#000000",
		},
	}),
}));

function StatefulDropdown() {
	const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
	const [status, setStatus] = useState<NoteStatus | undefined>(undefined);

	return (
		<NoteFiltersDropdown
			noteTypes={noteTypes}
			status={status}
			onNoteTypesChange={setNoteTypes}
			onStatusChange={setStatus}
		/>
	);
}

describe("NoteFiltersDropdown", () => {
	it("supports selecting multiple note types at once", async () => {
		const user = userEvent.setup();
		render(<StatefulDropdown />);

		await user.press(screen.getByRole("button", { name: "Filter notes" }));
		await user.press(screen.getByRole("checkbox", { name: "Notes" }));
		await user.press(screen.getByRole("checkbox", { name: "Journals" }));

		expect(screen.getByText("2 types")).toBeOnTheScreen();
		expect(screen.getByRole("checkbox", { name: "Notes" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Journals" })).toBeChecked();
	});

	it("shows the status section when todos are included", async () => {
		const user = userEvent.setup();
		render(<StatefulDropdown />);

		await user.press(screen.getByRole("button", { name: "Filter notes" }));
		await user.press(screen.getByRole("checkbox", { name: "Todos" }));

		expect(screen.getByText("Status")).toBeOnTheScreen();
	});
});
