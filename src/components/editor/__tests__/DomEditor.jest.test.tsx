import DomEditor from "@/components/editor/DomEditor";
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
		mockLexicalEditorRender.mockReset();
	});

	it("passes incoming markdown to Lexical", () => {
		render(
			<DomEditor
				markdown="initial markdown"
				onMarkdownChange={jest.fn()}
				themeMode="dark"
			/>,
		);

		expect(mockLexicalEditorRender).toHaveBeenLastCalledWith(
			expect.objectContaining({
				markdown: "initial markdown",
				themeMode: "dark",
			}),
		);
	});

	it("emits markdown changes from Lexical", () => {
		const onMarkdownChange = jest.fn();
		const { getByRole } = render(
			<DomEditor
				markdown="initial markdown"
				onMarkdownChange={onMarkdownChange}
				themeMode="dark"
			/>,
		);

		fireEvent.press(getByRole("button"));

		expect(onMarkdownChange).toHaveBeenCalledWith("updated markdown");
	});
});
