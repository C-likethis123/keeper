import { useEditorState } from "@/stores/editorStore";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { ScrollView } from "react-native";
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

	it("shows a sticky video overlay after scrolling past a video block", () => {
		const rendered = renderEditor(
			"Paragraph\n![video](https://youtu.be/dQw4w9WgXcQ)\nMore content",
		);
		const scrollView = rendered.UNSAFE_getByType(ScrollView);
		const videoRow = screen.getByTestId("video-block-row-1");

		expect(scrollView.props.stickyHeaderIndices).toBeUndefined();
		expect(screen.queryByTestId("sticky-video-overlay")).toBeNull();

		fireEvent(videoRow, "layout", {
			nativeEvent: { layout: { height: 220, width: 320, x: 0, y: 120 } },
		});
		fireEvent(scrollView, "layout", {
			nativeEvent: { layout: { height: 400, width: 320, x: 0, y: 0 } },
		});
		fireEvent.scroll(scrollView, {
			nativeEvent: { contentOffset: { y: 341 } },
		});

		const stickyOverlay = screen.getByTestId("sticky-video-overlay");
		const maxHeightStyle = stickyOverlay.props.style.find(
			(style: { maxHeight?: number }) => typeof style?.maxHeight === "number",
		);
		expect(maxHeightStyle?.maxHeight).toBeGreaterThan(0);
	});
});
