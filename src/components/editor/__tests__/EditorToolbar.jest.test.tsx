import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { BlockType } from "@/components/editor/core/BlockNode";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

const mockExecuteEditorCommand = jest.fn();
const mockHandleIndent = jest.fn();
const mockHandleOutdent = jest.fn();
const mockHandleConvertToCheckbox = jest.fn();
const mockHandleInsertImage = jest.fn();
const mockHandleInsertCollapsible = jest.fn();
const mockUseEditorState = jest.fn();

jest.mock("@/components/editor/keyboard/editorCommands", () => ({
	executeEditorCommand: (...args: unknown[]) =>
		mockExecuteEditorCommand(...args),
}));

jest.mock("@/components/editor/keyboard/useEditorCommandContext", () => ({
	useEditorCommandContext: () => ({ mocked: true }),
}));

jest.mock("@/hooks/useToolbarActions", () => ({
	useToolbarActions: () => ({
		handleIndent: mockHandleIndent,
		handleOutdent: mockHandleOutdent,
		handleConvertToCheckbox: mockHandleConvertToCheckbox,
		handleInsertImage: mockHandleInsertImage,
		handleInsertCollapsible: mockHandleInsertCollapsible,
	}),
}));

jest.mock("@/stores/editorStore", () => ({
	useEditorState: (selector: (state: unknown) => unknown) =>
		mockUseEditorState(selector),
}));

jest.mock("@/components/shared/IconButton", () => {
	const React = require("react");
	const { Pressable, Text } = require("react-native");
	return {
		IconButton: ({
			name,
			onPress,
			disabled,
		}: {
			name: string;
			onPress: () => void;
			disabled?: boolean;
		}) =>
			React.createElement(
				Pressable,
				{
					accessibilityRole: "button",
					accessibilityState: { disabled: !!disabled },
					onPress,
				},
				React.createElement(Text, null, name),
			),
	};
});

type MockState = {
	getCanUndo: () => boolean;
	getCanRedo: () => boolean;
	getFocusedBlock: () => {
		type: BlockType;
		attributes?: Record<string, unknown>;
	} | null;
};

function renderToolbar(stateOverrides: Partial<MockState> = {}) {
	const state: MockState = {
		getCanUndo: () => false,
		getCanRedo: () => false,
		getFocusedBlock: () => null,
		...stateOverrides,
	};
	mockUseEditorState.mockImplementation(
		(selector: (value: MockState) => unknown) => selector(state),
	);

	return render(<EditorToolbar />);
}

describe("EditorToolbar", () => {
	const originalPlatform = Platform.OS;

	beforeEach(() => {
		jest.clearAllMocks();
		(Platform as { OS: string }).OS = "ios";
	});

	afterAll(() => {
		(Platform as { OS: string }).OS = originalPlatform;
	});

	it("disables undo and redo when history is unavailable", () => {
		renderToolbar();

		expect(screen.getByRole("button", { name: "undo" })).toHaveProp(
			"accessibilityState",
			{ disabled: true },
		);
		expect(screen.getByRole("button", { name: "repeat" })).toHaveProp(
			"accessibilityState",
			{ disabled: true },
		);
	});

	it("enables list indent and outdent controls for list blocks within supported levels", () => {
		renderToolbar({
			getFocusedBlock: () => ({
				type: BlockType.bulletList,
				attributes: { listLevel: 2 },
			}),
		});

		expect(screen.getByRole("button", { name: "indent" })).toHaveProp(
			"accessibilityState",
			{ disabled: false },
		);
		expect(screen.getByRole("button", { name: "dedent" })).toHaveProp(
			"accessibilityState",
			{ disabled: false },
		);
	});

	it("disables indent when a list item is already at the maximum supported level", () => {
		renderToolbar({
			getFocusedBlock: () => ({
				type: BlockType.numberedList,
				attributes: { listLevel: 10 },
			}),
		});

		expect(screen.getByRole("button", { name: "indent" })).toHaveProp(
			"accessibilityState",
			{ disabled: true },
		);
		expect(screen.getByRole("button", { name: "dedent" })).toHaveProp(
			"accessibilityState",
			{ disabled: false },
		);
	});

	it("disables checkbox conversion when the focused block is already a checkbox", () => {
		renderToolbar({
			getFocusedBlock: () => ({
				type: BlockType.checkboxList,
				attributes: { listLevel: 0, checked: false },
			}),
		});

		expect(screen.getByRole("button", { name: "square-o" })).toHaveProp(
			"accessibilityState",
			{ disabled: true },
		);
	});

	it("dispatches undo, redo, indent, outdent, and checkbox actions from toolbar presses", () => {
		const { getByRole } = renderToolbar({
			getCanUndo: () => true,
			getCanRedo: () => true,
			getFocusedBlock: () => ({
				type: BlockType.bulletList,
				attributes: { listLevel: 1 },
			}),
		});

		fireEvent.press(getByRole("button", { name: "undo" }));
		fireEvent.press(getByRole("button", { name: "repeat" }));
		fireEvent.press(getByRole("button", { name: "indent" }));
		fireEvent.press(getByRole("button", { name: "dedent" }));
		fireEvent.press(getByRole("button", { name: "square-o" }));

		expect(mockExecuteEditorCommand).toHaveBeenNthCalledWith(
			1,
			"undo",
			expect.any(Object),
		);
		expect(mockExecuteEditorCommand).toHaveBeenNthCalledWith(
			2,
			"redo",
			expect.any(Object),
		);
		expect(mockHandleIndent).toHaveBeenCalledTimes(1);
		expect(mockHandleOutdent).toHaveBeenCalledTimes(1);
		expect(mockHandleConvertToCheckbox).toHaveBeenCalledTimes(1);
	});

	it("shows the web placeholder instead of the native image button on web", () => {
		(Platform as { OS: string }).OS = "web";

		renderToolbar();

		expect(screen.getByText("TODO: Insert Image")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "image" })).toBeNull();
	});

	it("renders the native image button outside web and wires it to image insertion", () => {
		const { getByRole } = renderToolbar();

		fireEvent.press(getByRole("button", { name: "image" }));

		expect(mockHandleInsertImage).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("TODO: Insert Image")).toBeNull();
	});

	it("inserts a collapsible section when the angle-down button is pressed", () => {
		const { getByRole } = renderToolbar();

		fireEvent.press(getByRole("button", { name: "angle-down" }));

		expect(mockHandleInsertCollapsible).toHaveBeenCalledTimes(1);
	});

	describe("attachment controls", () => {
		function setupDefaultState() {
			mockUseEditorState.mockImplementation(
				(selector: (value: MockState) => unknown) =>
					selector({
						getCanUndo: () => false,
						getCanRedo: () => false,
						getFocusedBlock: () => null,
					}),
			);
		}

		it("renders a disabled paperclip button when no onAttachDocument handler is provided", () => {
			setupDefaultState();
			render(<EditorToolbar />);

			// The IconButton mock renders the icon name as text; no label prop forwarded.
			expect(screen.getByRole("button", { name: "paperclip" })).toHaveProp(
				"accessibilityState",
				{ disabled: true },
			);
		});

		it("renders an enabled paperclip button and calls onAttachDocument when pressed", () => {
			setupDefaultState();
			const onAttachDocument = jest.fn();
			render(
				<EditorToolbar
					onAttachDocument={onAttachDocument}
					hasAttachment={false}
				/>,
			);

			const btn = screen.getByRole("button", { name: "paperclip" });
			expect(btn).toHaveProp("accessibilityState", { disabled: false });
			fireEvent.press(btn);
			expect(onAttachDocument).toHaveBeenCalledTimes(1);
		});

		it("shows the remove-attachment button instead of paperclip when hasAttachment is true", () => {
			setupDefaultState();
			const onRemoveAttachment = jest.fn();
			render(
				<EditorToolbar hasAttachment onRemoveAttachment={onRemoveAttachment} />,
			);

			expect(screen.queryByRole("button", { name: "paperclip" })).toBeNull();
			const removeBtn = screen.getByRole("button", { name: "times-circle" });
			fireEvent.press(removeBtn);
			expect(onRemoveAttachment).toHaveBeenCalledTimes(1);
		});
	});
});
