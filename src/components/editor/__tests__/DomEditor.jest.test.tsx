import DomEditor from "@/components/editor/DomEditor";
import { useEditorState } from "@/stores/editorStore";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

const mockLexicalEditorRender = jest.fn();

jest.mock("@/components/editor/lexical/LexicalMarkdownEditor", () => {
	const React = require("react");
	const { Pressable, Text } = require("react-native");

	return {
		__esModule: true,
		default: (props: {
			markdown: string;
			onMarkdownChange?: (markdown: string) => void;
		}) => {
			mockLexicalEditorRender(props);
			return React.createElement(
				Pressable,
				{
					accessibilityRole: "button",
					onPress: () => props.onMarkdownChange?.("updated markdown"),
				},
				React.createElement(Text, null, "Mock lexical editor"),
			);
		},
	};
});

describe("DomEditor", () => {
	beforeEach(() => {
		useEditorState.getState().resetState();
		mockLexicalEditorRender.mockReset();
	});

	it("loads incoming markdown into the editor store", () => {
		render(<DomEditor markdown="initial markdown" themeMode="dark" />);

		expect(useEditorState.getState().getContent()).toBe("initial markdown");
		expect(mockLexicalEditorRender).toHaveBeenLastCalledWith(
			expect.objectContaining({
				markdown: "initial markdown",
				themeMode: "dark",
			}),
		);
	});

	it("syncs markdown changes from Lexical back into the editor store", () => {
		const { getByRole } = render(
			<DomEditor markdown="initial markdown" themeMode="dark" />,
		);

		fireEvent.press(getByRole("button"));

		expect(useEditorState.getState().getContent()).toBe("updated markdown");
	});
});
