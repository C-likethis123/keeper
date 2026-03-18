import { beforeEach, describe, expect, it } from "vitest";
import {
	BlockType,
	createCheckboxBlock,
	createCodeBlock,
} from "../../components/editor/core/BlockNode";
import { createDocumentFromMarkdown } from "../../components/editor/core/Document";
import { createCollapsedSelection } from "../../components/editor/core/Selection";
import { useEditorState } from "../editorStore";

describe("editorStore", () => {
	beforeEach(() => {
		useEditorState.getState().resetState();
	});

	it("clears prepared markdown after document changes", () => {
		const store = useEditorState.getState();

		store.loadMarkdown("Alpha");
		store.prepareContent();
		expect(useEditorState.getState().getPreparedContent()).toEqual({
			version: useEditorState.getState().document.version,
			markdown: "Alpha",
		});

		useEditorState.getState().updateBlockContent(0, "Beta", 4);

		expect(useEditorState.getState().getPreparedContent()).toBeNull();
		expect(useEditorState.getState().selection).toEqual(
			createCollapsedSelection({ blockIndex: 0, offset: 4 }),
		);
		expect(useEditorState.getState().getContent()).toBe("Beta");
	});

	it("replaces a selected block range with a single paragraph block", () => {
		useEditorState
			.getState()
			.setDocument(createDocumentFromMarkdown("Alpha\n\nBeta"));
		useEditorState.getState().selectBlockRange(0, 1);

		useEditorState.getState().deleteSelectedBlocks();

		const state = useEditorState.getState();
		expect(state.blockSelection).toBeNull();
		expect(state.document.blocks).toHaveLength(2);
		expect(state.document.blocks[0].type).toBe(BlockType.paragraph);
		expect(state.document.blocks[0].content).toBe("");
		expect(state.document.blocks[1].content).toBe("Beta");
	});

	it("splits checkbox blocks into a new unchecked item at the same list level", () => {
		useEditorState.getState().setDocument({
			...createDocumentFromMarkdown(""),
			blocks: [createCheckboxBlock("Finish docs", 2, true)],
		});

		useEditorState.getState().splitBlock(0, 6);

		const blocks = useEditorState.getState().document.blocks;
		expect(blocks).toHaveLength(2);
		expect(blocks[0].type).toBe(BlockType.checkboxList);
		expect(blocks[0].content).toBe("Finish");
		expect(blocks[0].attributes).toEqual({ listLevel: 2, checked: true });
		expect(blocks[1].type).toBe(BlockType.checkboxList);
		expect(blocks[1].content).toBe(" docs");
		expect(blocks[1].attributes).toEqual({ listLevel: 2, checked: false });
	});

	it("does not merge into code blocks or image blocks", () => {
		useEditorState.getState().setDocument({
			...createDocumentFromMarkdown(""),
			blocks: [createCodeBlock("const x = 1;"), createCheckboxBlock("Task", 0)],
		});
		const beforeVersion = useEditorState.getState().document.version;

		useEditorState.getState().mergeWithPrevious(1);

		const state = useEditorState.getState();
		expect(state.document.version).toBe(beforeVersion);
		expect(state.document.blocks).toHaveLength(2);
		expect(state.document.blocks[0].type).toBe(BlockType.codeBlock);
		expect(state.document.blocks[1].content).toBe("Task");
	});

	it("resetState clears document state and history", () => {
		useEditorState.getState().loadMarkdown("Alpha");
		useEditorState.getState().updateBlockContent(0, "Beta");
		expect(useEditorState.getState().getCanUndo()).toBe(true);

		useEditorState.getState().resetState();

		const state = useEditorState.getState();
		expect(state.document.blocks).toHaveLength(1);
		expect(state.document.blocks[0].content).toBe("");
		expect(state.selection).toBeNull();
		expect(state.getCanUndo()).toBe(false);
		expect(state.getCanRedo()).toBe(false);
	});
});
