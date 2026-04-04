import { useEditorState } from "@/stores/editorStore";
import {
	fireEvent,
	screen,
	userEvent,
	waitFor,
} from "@testing-library/react-native";
import React from "react";
import { TextInput } from "react-native";
import {
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

describe("HybridEditor slash commands", () => {
	beforeEach(() => {
		resetHybridEditorHarness("ios");
	});

	afterAll(() => {
		restorePlatformOs();
	});

	it("opens slash commands on slash and invokes the insert template action", async () => {
		const user = userEvent.setup();
		const onInsertTemplateCommand = jest.fn();

		renderEditor("", { onInsertTemplateCommand });

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "/");

		await screen.findByPlaceholderText("Type a command...");
		await user.press(screen.getByText("Insert template"));

		await waitFor(() => {
			expect(onInsertTemplateCommand).toHaveBeenCalledTimes(1);
		});
		expect(useEditorState.getState().getContent()).toBe("");
	});
});
