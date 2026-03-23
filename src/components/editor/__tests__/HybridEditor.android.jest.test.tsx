import { screen, userEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import {
	mockListNotes,
	mockPush,
	mockSaveNote,
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

describe("HybridEditor wikilinks on Android", () => {
	beforeEach(() => {
		resetHybridEditorHarness("android");
	});

	afterAll(() => {
		restorePlatformOs();
	});

	it("navigates to an existing note when a rendered wikilink is pressed", async () => {
		const user = userEvent.setup();
		mockListNotes.mockResolvedValue({
			items: [
				{
					noteId: "android-note-123",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		renderEditor("[[Project Alpha]]");

		await user.press(screen.getByText("Project Alpha"));

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/editor?id=android-note-123");
		});
		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("creates and opens a missing note target when a rendered wikilink is pressed", async () => {
		const user = userEvent.setup();
		mockListNotes.mockResolvedValue({ items: [] });
		mockSaveNote.mockResolvedValue({
			id: "generated-note-id",
			title: "Project Alpha",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "note",
		});

		renderEditor("[[Project Alpha]]");

		await user.press(screen.getByText("Project Alpha"));

		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "generated-note-id",
					title: "Project Alpha",
					content: "",
					isPinned: false,
					noteType: "note",
				}),
				true,
			);
		});
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/editor?id=generated-note-id");
		});
	});
});
