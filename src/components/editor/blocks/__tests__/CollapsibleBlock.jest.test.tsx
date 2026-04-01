import { render, screen, fireEvent } from "@testing-library/react-native";
import { CollapsibleBlock } from "../CollapsibleBlock";
import { createCollapsibleBlock } from "../../core/BlockNode";
import React from "react";

// Mock hooks
const mockFocusBlock = jest.fn();
const mockBlurBlock = jest.fn();

jest.mock("@/hooks/useFocusBlock", () => ({
	useFocusBlock: () => ({ focusBlock: mockFocusBlock, blurBlock: mockBlurBlock }),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: { text: "#000", primary: "#00f" },
		custom: { editor: { blockBackground: "#fff", blockBorder: "#ccc", blockFocused: "#eee", placeholder: "#999" } },
		typography: { body: { fontSize: 16 } },
	}),
}));

describe("CollapsibleBlock", () => {
	const defaultProps = {
		block: createCollapsibleBlock("Summary", "Body"),
		index: 0,
		isFocused: true,
		onContentChange: jest.fn(),
		onAttributesChange: jest.fn(),
		onBackspaceAtStart: jest.fn(),
		onEnter: jest.fn(),
		onSelectionChange: jest.fn(),
		onDelete: jest.fn(),
		onSpace: jest.fn(),
		onCheckboxToggle: jest.fn(),
		onOpenWikiLink: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("calls onBackspaceAtStart when summary is empty and backspace is pressed", () => {
		const props = {
			...defaultProps,
			block: createCollapsibleBlock("", "Body", true), // Empty summary, expanded
			onBackspaceAtStart: jest.fn(),
		};
		render(<CollapsibleBlock {...props} />);

		const input = screen.getByPlaceholderText("Section title...");
		fireEvent(input, "keyPress", { nativeEvent: { key: "Backspace" } });

		expect(props.onBackspaceAtStart).toHaveBeenCalledWith(0);
	});

	it("calls onEnter with 'summary' zone and current offset when Enter is pressed in summary", () => {
		const props = {
			...defaultProps,
			onEnter: jest.fn(),
		};
		render(<CollapsibleBlock {...props} />);

		const input = screen.getByDisplayValue("Summary");

		// Simulate selection change to offset 3 (Sum|mary)
		fireEvent(input, "selectionChange", {
			nativeEvent: { selection: { start: 3, end: 3 } },
		});

		// Press Enter
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		expect(props.onEnter).toHaveBeenCalledWith(0, 3, "summary");
	});

	it("calls onEnter with 'body' zone when Enter is pressed in empty body", () => {
		const props = {
			...defaultProps,
			block: createCollapsibleBlock("Summary", "", true), // Empty body, expanded
			onEnter: jest.fn(),
		};
		render(<CollapsibleBlock {...props} />);

		const input = screen.getByPlaceholderText("Section body...");
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		expect(props.onEnter).toHaveBeenCalledWith(0, 0, "body");
	});
});
