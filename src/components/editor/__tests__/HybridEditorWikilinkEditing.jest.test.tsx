import { useEditorState } from "@/stores/editorStore";
import { fireEvent, screen, userEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { TextInput } from "react-native";
import {
	mockListNotes,
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

describe("HybridEditor wikilink editing flows", () => {
	beforeEach(() => {
		resetHybridEditorHarness("ios");
		mockListNotes.mockResolvedValue({ items: [] });
	});

	afterEach(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

	afterAll(() => {
		restorePlatformOs();
	});

	it("seeds the modal query from text typed after the wikilink trigger", async () => {
		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "[[Project");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Project");
		await waitFor(() => {
			expect(mockListNotes).toHaveBeenCalledWith(
				"Project",
				expect.any(Number),
				0,
			);
		});
		expect(useEditorState.getState().getContent()).toBe("[[");
	});

	it("replaces the typed trigger with the selected wikilink", async () => {
		const user = userEvent.setup();
		mockListNotes.mockResolvedValue({
			items: [
				{
					noteId: "note-123",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "[[Project");

		await user.press(await screen.findByText("Project Alpha"));

		await waitFor(() => {
			expect(useEditorState.getState().getContent()).toBe("[[Project Alpha]]");
		});
		expect(
			useEditorState.getState().selection?.focus.offset,
		).toBe("[[Project Alpha]]".length);
		expect(
			screen.queryByPlaceholderText("Search or create notes..."),
		).not.toBeOnTheScreen();
	});

	it("removes the trigger token and restores focus when the modal is cancelled", async () => {
		renderEditor("Before ");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "Before [[Draft");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Draft");

		fireEvent(modalInput, "keyPress", { nativeEvent: { key: "Escape" } });

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Search or create notes..."),
			).not.toBeOnTheScreen();
		});
		expect(useEditorState.getState().getContent()).toBe("Before ");
		await waitFor(() => {
			expect(useEditorState.getState().selection?.focus.blockIndex).toBe(0);
		});
		expect(useEditorState.getState().selection?.focus.offset).toBe(
			"Before ".length,
		);
	});

	it("hands off cleanly from slash commands to wikilinks without corrupting text", async () => {
		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "/");

		expect(await screen.findByPlaceholderText("Type a command...")).toBeOnTheScreen();

		fireEvent.changeText(input, "[[Roadmap");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Roadmap");
		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Type a command..."),
			).not.toBeOnTheScreen();
		});
		expect(useEditorState.getState().getContent()).toBe("[[");
	});
});
