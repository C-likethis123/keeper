import { BlockRow } from "@/components/editor/BlockRow";
import { BlockType } from "@/components/editor/core/BlockNode";
import { createDocumentFromMarkdown } from "@/components/editor/core/Document";
import { useEditorState } from "@/stores/editorStore";
import { render } from "@testing-library/react-native";
import React from "react";
import { Platform, Text, View } from "react-native";
import { blockRegistry } from "../blocks/BlockRegistry";

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		dark: false,
		colors: {
			primary: "#2563eb",
			text: "#111827",
			background: "#ffffff",
		},
		typography: {
			body: { fontSize: 16, lineHeight: 24 },
			heading1: {},
			heading2: {},
			heading3: {},
		},
		custom: {
			editor: {
				blockFocused: "#f3f4f6",
				blockBorder: "#d1d5db",
				blockBackground: "#ffffff",
				placeholder: "#9ca3af",
				inlineCode: {
					fontFamily: "monospace",
					backgroundColor: "#f3f4f6",
					color: "#111827",
				},
			},
		},
	}),
}));

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
	onSelectBlock: jest.fn(),
	onSelectBlockRange: jest.fn(),
	onSelectGap: jest.fn(),
	onClearStructuredSelection: jest.fn(),
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

	it("passes block and gap selection state into the block registry", () => {
		const buildSpy = jest
			.spyOn(blockRegistry, "build")
			.mockReturnValue(<Text>Mock Block</Text>);

		useEditorState.setState({
			document: createDocumentFromMarkdown("Alpha\nBeta"),
			blockSelection: { start: 0, end: 1 },
			blockSelectionAnchor: 0,
			gapSelection: { index: 1 },
		});

		render(<BlockRow index={1} handlers={handlers} />);

		expect(buildSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				hasBlockSelection: true,
				isGapSelected: true,
				clearStructuredSelection: handlers.onClearStructuredSelection,
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
		expect(
			UNSAFE_getAllByType(View).some((view) =>
				Array.isArray(view.props.style)
					? view.props.style.some(
							(style: Record<string, unknown> | undefined) =>
								style?.position ===
									(Platform.OS === "web" ? "sticky" : "relative") &&
								style.top === 0 &&
								style.zIndex === 20,
						)
					: false,
			),
		).toBe(true);
	});
});
