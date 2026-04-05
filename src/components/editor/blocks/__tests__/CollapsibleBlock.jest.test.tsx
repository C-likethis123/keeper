import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { createCollapsibleBlock } from "../../core/BlockNode";
import { CollapsibleBlock } from "../CollapsibleBlock";

// Mock hooks
const mockFocusBlock = jest.fn();
const mockBlurBlock = jest.fn();

jest.mock("@/hooks/useFocusBlock", () => ({
	useFocusBlock: () => ({
		focusBlock: mockFocusBlock,
		blurBlock: mockBlurBlock,
	}),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: { text: "#000", primary: "#00f" },
		custom: {
			editor: {
				blockBackground: "#fff",
				blockBorder: "#ccc",
				blockFocused: "#eee",
				placeholder: "#999",
			},
		},
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

	it("moves focus to body when Enter is pressed in summary", () => {
		const props = {
			...defaultProps,
			onEnter: jest.fn(),
			onAttributesChange: jest.fn(),
		};
		render(<CollapsibleBlock {...props} />);

		const input = screen.getByDisplayValue("Summary");

		// Press Enter
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		// It should NOT split the block anymore
		expect(props.onEnter).not.toHaveBeenCalled();
	});

	it("expands block and moves focus when Enter is pressed in collapsed summary", () => {
		const props = {
			...defaultProps,
			block: createCollapsibleBlock("Summary", "Body", false), // Collapsed
			onAttributesChange: jest.fn(),
		};
		render(<CollapsibleBlock {...props} />);

		const input = screen.getByDisplayValue("Summary");

		// Press Enter
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		// It should call onAttributesChange to expand
		expect(props.onAttributesChange).toHaveBeenCalledWith(
			0,
			expect.objectContaining({ isExpanded: true }),
		);
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

	it("focuses the block when the unfocused summary is pressed", () => {
		const props = {
			...defaultProps,
			isFocused: false,
		};
		render(<CollapsibleBlock {...props} />);

		fireEvent.press(screen.getByText("Summary"));

		expect(mockFocusBlock).toHaveBeenCalledWith(0);
	});
});
