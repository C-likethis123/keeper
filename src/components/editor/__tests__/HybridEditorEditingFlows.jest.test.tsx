import { useEditorState } from "@/stores/editorStore";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";
import {
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

describe("HybridEditor editing flows", () => {
	beforeEach(() => {
		resetHybridEditorHarness("ios");
	});

	afterAll(() => {
		restorePlatformOs();
	});

	function focusBlockAt(blockIndex: number, offset: number) {
		useEditorState.getState().setSelection({
			anchor: { blockIndex, offset },
			focus: { blockIndex, offset },
		});
	}

	describe("Enter key — block splitting", () => {
		it("splits a paragraph block at the cursor position", () => {
			renderEditor("hello world");

			// Focus at offset 5 (after "hello")
			act(() => {
				focusBlockAt(0, 5);
			});

			const input = screen.UNSAFE_getByType(TextInput);
			fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

			const state = useEditorState.getState();
			const blocks = state.document.blocks;
			expect(blocks).toHaveLength(2);
			expect(blocks[0].content).toBe("hello");
			expect(blocks[1].content).toBe(" world");
		});

		it("splits at end of block, leaving a new empty block", () => {
			renderEditor("hello");

			act(() => {
				focusBlockAt(0, 5);
			});

			const input = screen.UNSAFE_getByType(TextInput);
			fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

			const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(2);
			expect(blocks[0].content).toBe("hello");
			expect(blocks[1].content).toBe("");
		});

		it("splits at start of block, leaving an empty first block", () => {
			renderEditor("hello");

			act(() => {
				focusBlockAt(0, 0);
			});

			const input = screen.UNSAFE_getByType(TextInput);
			fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

			const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(2);
			expect(blocks[0].content).toBe("");
			expect(blocks[1].content).toBe("hello");
		});

		it("converts an empty list block to paragraph on Enter instead of splitting", () => {
			renderEditor("- ");

			act(() => {
				focusBlockAt(0, 0);
			});

			// Simulate space to trigger bullet detection then enter on empty bullet
			act(() => {
				useEditorState.getState().loadMarkdown("- item\n- ");
				useEditorState.getState().setSelection({
					anchor: { blockIndex: 1, offset: 0 },
					focus: { blockIndex: 1, offset: 0 },
				});
			});

			const inputs = screen.UNSAFE_getAllByType(TextInput);
			fireEvent(inputs[1], "keyPress", { nativeEvent: { key: "Enter" } });

			const { BlockType } = require("@/components/editor/core/BlockNode");
			const blocks = useEditorState.getState().document.blocks;
			// Empty bullet + Enter → paragraph conversion
			expect(blocks[1].type).toBe(BlockType.paragraph);
		});
	});

	describe("Backspace at start — block merging and deletion", () => {
		it("merges a paragraph block into the previous block on Backspace at position 0", () => {
			renderEditor("first\nsecond");

			act(() => {
				focusBlockAt(1, 0);
			});

			const inputs = screen.UNSAFE_getAllByType(TextInput);
			fireEvent(inputs[1], "keyPress", { nativeEvent: { key: "Backspace" } });

			const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(1);
			expect(blocks[0].content).toBe("firstsecond");
		});

		it("deletes an empty block on Backspace at position 0", () => {
			renderEditor("first\n");

			act(() => {
				// block 1 is the empty paragraph after "first"
				focusBlockAt(1, 0);
			});

			const inputs = screen.UNSAFE_getAllByType(TextInput);
			fireEvent(inputs[1], "keyPress", { nativeEvent: { key: "Backspace" } });

			const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(1);
			expect(blocks[0].content).toBe("first");
		});

		it("converts a heading to a paragraph on Backspace at position 0", () => {
			renderEditor("# Heading");

			act(() => {
				focusBlockAt(0, 0);
			});

			const { BlockType } = require("@/components/editor/core/BlockNode");
			const input = screen.UNSAFE_getByType(TextInput);
			fireEvent(input, "keyPress", { nativeEvent: { key: "Backspace" } });

			const blocks = useEditorState.getState().document.blocks;
			expect(blocks[0].type).toBe(BlockType.paragraph);
		});

		it("does not merge when there is no previous block", () => {
			renderEditor("only block");

			act(() => {
				focusBlockAt(0, 0);
			});

			const input = screen.UNSAFE_getByType(TextInput);
			fireEvent(input, "keyPress", { nativeEvent: { key: "Backspace" } });

			// Single non-empty paragraph at index 0 — no merge, no delete
			const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(1);
			expect(blocks[0].content).toBe("only block");
		});
	});
});
