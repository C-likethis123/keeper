import { createDocumentFromMarkdown } from "../Document";
import {
	editorReducer,
	initialEditorStateSlice,
} from "../EditorState";
import { History } from "../History";
import { createCollapsedSelection } from "../Selection";
import { TransactionBuilder } from "../Transaction";

describe("EditorState", () => {
	it("normalizes reversed block-range selections", () => {
		const history = new History({ groupingDelay: 0 });
		const document = createDocumentFromMarkdown("Alpha\n\nBeta");
		const state = {
			...initialEditorStateSlice,
			document,
			selection: createCollapsedSelection({ blockIndex: 1, offset: 0 }),
		};

		const next = editorReducer(
			state,
			{ type: "SELECT_BLOCK_RANGE", start: 2, end: 0 },
			history,
		);

		expect(next.blockSelection).toEqual({ start: 0, end: 2 });
		expect(next.selection).toBeNull();
	});

	it("selects every block in the current document", () => {
		const history = new History({ groupingDelay: 0 });
		const state = {
			...initialEditorStateSlice,
			document: createDocumentFromMarkdown("Alpha\n\nBeta"),
		};

		const next = editorReducer(state, { type: "SELECT_ALL_BLOCKS" }, history);

		expect(next.blockSelection).toEqual({ start: 0, end: 2 });
	});

	it("applies transactions and restores them through undo and redo", () => {
		const history = new History({ groupingDelay: 0 });
		const beforeSelection = createCollapsedSelection({ blockIndex: 0, offset: 5 });
		const afterSelection = createCollapsedSelection({ blockIndex: 0, offset: 4 });
		const initial = {
			...initialEditorStateSlice,
			document: createDocumentFromMarkdown("Alpha"),
			selection: beforeSelection,
		};
		const transaction = new TransactionBuilder()
			.updateContent(0, "Alpha", "Beta")
			.withSelectionBefore(beforeSelection)
			.withSelectionAfter(afterSelection)
			.withDescription("Rename block")
			.build();

		const updated = editorReducer(
			initial,
			{ type: "APPLY_TRANSACTION", transaction },
			history,
		);
		const undone = editorReducer(updated, { type: "UNDO" }, history);
		const redone = editorReducer(undone, { type: "REDO" }, history);

		expect(updated.document.blocks[0].content).toBe("Beta");
		expect(updated.selection).toEqual(afterSelection);
		expect(undone.document.blocks[0].content).toBe("Alpha");
		expect(undone.selection).toEqual(beforeSelection);
		expect(redone.document.blocks[0].content).toBe("Beta");
		expect(redone.selection).toEqual(afterSelection);
	});

	it("clears undo history when a new document is set", () => {
		const history = new History({ groupingDelay: 0 });
		const initial = {
			...initialEditorStateSlice,
			document: createDocumentFromMarkdown("Alpha"),
		};
		const updated = editorReducer(
			initial,
			{
				type: "APPLY_TRANSACTION",
				transaction: new TransactionBuilder()
					.updateContent(0, "Alpha", "Beta")
					.build(),
			},
			history,
		);

		const replaced = editorReducer(
			updated,
			{
				type: "SET_DOCUMENT",
				document: createDocumentFromMarkdown("Fresh"),
			},
			history,
		);
		const afterUndo = editorReducer(replaced, { type: "UNDO" }, history);

		expect(replaced.document.blocks[0].content).toBe("Fresh");
		expect(afterUndo.document.blocks[0].content).toBe("Fresh");
	});
});
