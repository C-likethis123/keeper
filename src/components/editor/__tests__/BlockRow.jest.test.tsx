import { BlockRow } from "@/components/editor/BlockRow";
import { BlockType } from "@/components/editor/core/BlockNode";
import { createDocumentFromMarkdown } from "@/components/editor/core/Document";
import { useEditorState } from "@/stores/editorStore";
import { render } from "@testing-library/react-native";
import React from "react";
import { Platform, Text, View } from "react-native";
import { blockRegistry } from "../blocks/BlockRegistry";

const handlers = {
	onContentChange: jest.fn(),
	onBlockTypeChange: jest.fn(),
	onBackspaceAtStart: jest.fn(),
	onSpace: jest.fn(() => false),
	onEnter: jest.fn(),
	onSelectionChange: jest.fn(),
	onDelete: jest.fn(),
	onCheckboxToggle: jest.fn(),
	onOpenWikiLink: jest.fn(),
};

describe("BlockRow", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useEditorState.getState().resetState();
	});

	it("passes the computed numbered-list item number into the block registry", () => {
		const buildSpy = jest
			.spyOn(blockRegistry, "build")
			.mockReturnValue(<Text>Mock Block</Text>);

		useEditorState.setState({
			document: createDocumentFromMarkdown("1. First\n2. Second"),
		});

		render(<BlockRow index={1} handlers={handlers} />);

		expect(buildSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				index: 1,
				listItemNumber: 2,
			}),
		);
	});

	it("wraps video blocks in a sticky container", () => {
		const buildSpy = jest
			.spyOn(blockRegistry, "build")
			.mockReturnValue(<Text>Mock Video</Text>);

		useEditorState.setState({
			document: createDocumentFromMarkdown(
				"![video](https://example.com/video)",
			),
		});

		const { UNSAFE_getAllByType } = render(
			<BlockRow index={0} handlers={handlers} />,
		);

		expect(buildSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				block: expect.objectContaining({ type: BlockType.video }),
			}),
		);
		expect(UNSAFE_getAllByType(View)[0].props.style).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					position: Platform.OS === "web" ? "sticky" : "relative",
					top: 0,
					zIndex: 20,
				}),
			]),
		);
	});
});
