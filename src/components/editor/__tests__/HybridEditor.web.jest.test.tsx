import { useEditorState } from "@/stores/editorStore";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import {
	mockListNotes,
	mockPush,
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

describe("HybridEditor wikilinks on web", () => {
	beforeEach(() => {
		resetHybridEditorHarness("web");
	});

	afterAll(() => {
		restorePlatformOs();
	});

	it("focuses the block instead of opening the link without the modifier key", async () => {
		renderEditor("[[Project Alpha]]");

		fireEvent.press(screen.getByText("Project Alpha"), {
			nativeEvent: { metaKey: false },
		});

		await waitFor(() => {
			expect(useEditorState.getState().selection?.focus.blockIndex).toBe(0);
		});
		expect(useEditorState.getState().selection?.focus.offset).toBe(17);
		expect(mockListNotes).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("opens the link when the modifier key is pressed", async () => {
		const preventDefault = jest.fn();
		const stopPropagation = jest.fn();
		mockListNotes.mockResolvedValue({
			items: [
				{
					noteId: "web-note-456",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		renderEditor("[[Project Alpha]]");

		fireEvent(screen.getByText("Project Alpha"), "press", {
			nativeEvent: { metaKey: true },
			preventDefault,
			stopPropagation,
		});

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/editor?id=web-note-456");
		});
		expect(preventDefault).toHaveBeenCalled();
		expect(stopPropagation).toHaveBeenCalled();
	});
});
