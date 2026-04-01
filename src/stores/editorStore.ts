import {
	type BlockNode,
	BlockType,
	createParagraphBlock,
	getBlockLanguage,
	getListLevel,
} from "@/components/editor/core/BlockNode";
import {
	type Document,
	createDocumentFromMarkdown,
	createEmptyDocument,
	documentToMarkdown,
} from "@/components/editor/core/Document";
import {
	type EditorState,
	type EditorStateSlice,
	editorReducer,
	initialEditorStateSlice,
} from "@/components/editor/core/EditorState";
import { History } from "@/components/editor/core/History";
import type { DocumentSelection } from "@/components/editor/core/Selection";
import { createCollapsedSelection } from "@/components/editor/core/Selection";
import {
	type Transaction,
	TransactionBuilder,
} from "@/components/editor/core/Transaction";
import { useCallback, useRef } from "react";
import { create } from "zustand";

type EditorAction = Parameters<typeof editorReducer>[1];

function isSelectionBackward(selection: DocumentSelection): boolean {
	if (selection.anchor.blockIndex !== selection.focus.blockIndex) {
		return selection.focus.blockIndex < selection.anchor.blockIndex;
	}
	return selection.focus.offset < selection.anchor.offset;
}

function createSelectionForRange(
	blockIndex: number,
	start: number,
	end: number,
	backward = false,
): DocumentSelection {
	if (backward) {
		return {
			anchor: { blockIndex, offset: end },
			focus: { blockIndex, offset: start },
		};
	}

	return {
		anchor: { blockIndex, offset: start },
		focus: { blockIndex, offset: end },
	};
}

function isInlineFormattingUnsupported(type: BlockType): boolean {
	return [
		BlockType.codeBlock,
		BlockType.mathBlock,
		BlockType.image,
		BlockType.video,
	].includes(type);
}

const history = new History();
export const useEditorState = create<EditorState>()((set, get) => {
	const dispatch = (action: EditorAction) =>
		set((state) => {
			const nextState = editorReducer(state, action, history);
			switch (action.type) {
				case "SET_DOCUMENT":
				case "APPLY_TRANSACTION":
				case "UNDO":
				case "REDO":
					return {
						...nextState,
						preparedMarkdown: null,
						preparedVersion: null,
					};
				default:
					return nextState;
			}
		});

	return {
		...initialEditorStateSlice,

		setDocument: (document: Document) =>
			dispatch({ type: "SET_DOCUMENT", document }),

		setSelection: (selection: EditorStateSlice["selection"]) =>
			dispatch({ type: "SET_SELECTION", selection }),

		clearBlockSelection: () => dispatch({ type: "CLEAR_BLOCK_SELECTION" }),

		selectBlock: (index: number) => dispatch({ type: "SELECT_BLOCK", index }),

		selectBlockRange: (start: number, end: number) =>
			dispatch({ type: "SELECT_BLOCK_RANGE", start, end }),

		selectAllBlocks: () => dispatch({ type: "SELECT_ALL_BLOCKS" }),

		deleteSelectedBlocks: () => {
			const s = get();
			if (!s.blockSelection) return;
			const { start, end } = s.blockSelection;
			const oldBlocks = s.document.blocks.slice(start, end + 1);
			const transaction = new TransactionBuilder()
				.replaceBlocks(start, end + 1, oldBlocks, [createParagraphBlock()])
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
			dispatch({ type: "CLEAR_BLOCK_SELECTION" });
		},

		applyTransaction: (transaction: Transaction) =>
			dispatch({ type: "APPLY_TRANSACTION", transaction }),

		undo: () => {
			if (!history.canUndo) return false;
			dispatch({ type: "UNDO" });
			return true;
		},

		redo: () => {
			if (!history.canRedo) return false;
			dispatch({ type: "REDO" });
			return true;
		},

		updateBlockContent: (
			index: number,
			newContent: string,
			selectionOffset?: number,
		) => {
			const s = get();
			const block = s.document.blocks[index];
			if (block.content === newContent) return;
			let builder = new TransactionBuilder()
				.updateContent(index, block.content, newContent)
				.withSelectionBefore(s.selection)
				.withDescription("Update content");
			if (selectionOffset !== undefined) {
				builder = builder.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: index,
						offset: selectionOffset,
					}),
				);
			}
			dispatch({ type: "APPLY_TRANSACTION", transaction: builder.build() });
		},
		updateBlockType: (index: number, newType: BlockType, language?: string) => {
			const s = get();
			const block = s.document.blocks[index];
			if (block.type === newType && getBlockLanguage(block) === language)
				return;
			const transaction = new TransactionBuilder()
				.updateType(
					index,
					block.type,
					newType,
					getBlockLanguage(block),
					language,
				)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(s.selection)
				.withDescription("Change block type")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		updateBlockListLevel: (index: number, newLevel: number) => {
			const s = get();
			const block = s.document.blocks[index];
			if (getListLevel(block) === newLevel) return;
			const oldAttrs = { ...block.attributes };
			const newAttrs = { ...block.attributes, listLevel: newLevel };
			const transaction = new TransactionBuilder()
				.updateBlockAttributes(index, oldAttrs, newAttrs)
				.withDescription("Update list level")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		updateBlockAttributes: (
			index: number,
			newAttrs: Record<string, unknown>,
		) => {
			const s = get();
			const block = s.document.blocks[index];
			if (!block) return;
			const oldAttrs = block.attributes ?? {};
			const transaction = new TransactionBuilder()
				.updateBlockAttributes(index, oldAttrs, newAttrs)
				.withDescription("Update block attributes")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		toggleCheckbox: (index: number) => {
			const s = get();
			const block = s.document.blocks[index];
			if (block.type !== BlockType.checkboxList) return;
			const oldAttrs = block.attributes ?? {};
			const checked = !!oldAttrs.checked;
			const newAttrs = { ...oldAttrs, checked: !checked };
			const transaction = new TransactionBuilder()
				.updateBlockAttributes(index, oldAttrs, newAttrs)
				.withDescription("Toggle checkbox")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		toggleInlineStyle: (marker: string) => {
			const s = get();
			const selection = s.selection;
			if (
				!selection ||
				selection.anchor.blockIndex !== selection.focus.blockIndex
			) {
				return false;
			}

			const index = selection.focus.blockIndex;
			const block = s.document.blocks[index];
			if (!block || isInlineFormattingUnsupported(block.type)) {
				return false;
			}

			const start = Math.min(selection.anchor.offset, selection.focus.offset);
			const end = Math.max(selection.anchor.offset, selection.focus.offset);
			const markerLength = marker.length;
			const backward = isSelectionBackward(selection);
			const content = block.content;

			if (start === end) {
				const newContent =
					content.slice(0, start) + marker + marker + content.slice(end);
				const transaction = new TransactionBuilder()
					.updateContent(index, content, newContent)
					.withSelectionBefore(selection)
					.withSelectionAfter(
						createCollapsedSelection({
							blockIndex: index,
							offset: start + markerLength,
						}),
					)
					.withDescription(`Insert ${marker} inline style`)
					.build();
				dispatch({ type: "APPLY_TRANSACTION", transaction });
				return true;
			}

			const hasWrappedSelection =
				start >= markerLength &&
				content.slice(start - markerLength, start) === marker &&
				content.slice(end, end + markerLength) === marker;

			let newContent: string;
			let nextStart: number;
			let nextEnd: number;

			if (hasWrappedSelection) {
				newContent =
					content.slice(0, start - markerLength) +
					content.slice(start, end) +
					content.slice(end + markerLength);
				nextStart = start - markerLength;
				nextEnd = end - markerLength;
			} else {
				newContent =
					content.slice(0, start) +
					marker +
					content.slice(start, end) +
					marker +
					content.slice(end);
				nextStart = start + markerLength;
				nextEnd = end + markerLength;
			}

			const transaction = new TransactionBuilder()
				.updateContent(index, content, newContent)
				.withSelectionBefore(selection)
				.withSelectionAfter(
					createSelectionForRange(index, nextStart, nextEnd, backward),
				)
				.withDescription(`Toggle ${marker} inline style`)
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
			return true;
		},

		toggleCurrentBlockType: (targetType: BlockType) => {
			const s = get();
			const index = s.selection?.focus.blockIndex ?? null;
			if (index === null) return false;

			const block = s.document.blocks[index];
			if (!block || isInlineFormattingUnsupported(block.type)) {
				return false;
			}

			const nextType =
				block.type === targetType ? BlockType.paragraph : targetType;
			if (block.type === nextType) {
				return false;
			}

			const transaction = new TransactionBuilder()
				.updateType(
					index,
					block.type,
					nextType,
					getBlockLanguage(block),
					undefined,
				)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(s.selection)
				.withDescription("Toggle block type")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
			return true;
		},

		insertSoftLineBreak: () => {
			const s = get();
			const selection = s.selection;
			if (
				!selection ||
				selection.anchor.blockIndex !== selection.focus.blockIndex
			) {
				return false;
			}

			const index = selection.focus.blockIndex;
			const block = s.document.blocks[index];
			if (!block) {
				return false;
			}

			const isSoftLineBreakNotSupported = [
				BlockType.codeBlock,
				BlockType.mathBlock,
				BlockType.image,
				BlockType.video,
			].includes(block.type);
			if (isSoftLineBreakNotSupported) {
				return false;
			}

			const start = Math.min(selection.anchor.offset, selection.focus.offset);
			const end = Math.max(selection.anchor.offset, selection.focus.offset);
			const newContent = `${block.content.slice(0, start)}\n${block.content.slice(end)}`;
			const newCursorOffset = start + 1;

			const transaction = new TransactionBuilder()
				.updateContent(index, block.content, newContent)
				.withSelectionBefore(selection)
				.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: index,
						offset: newCursorOffset,
					}),
				)
				.withDescription("Insert soft line break")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
			return true;
		},

		insertBlockAfter: (index: number, block: BlockNode) => {
			const s = get();
			const transaction = new TransactionBuilder()
				.insertBlock(index + 1, block)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: index + 1,
						offset: 0,
					}),
				)
				.withDescription("Insert block")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		deleteBlock: (index: number) => {
			const s = get();
			if (s.document.blocks.length <= 1) {
				dispatch({ type: "SET_DOCUMENT", document: createEmptyDocument() });
				return;
			}
			const block = s.document.blocks[index];
			const newFocusIndex = index > 0 ? index - 1 : 0;
			const newFocusBlock =
				index > 0 ? s.document.blocks[index - 1] : s.document.blocks[1];
			const transaction = new TransactionBuilder()
				.deleteBlock(index, block)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: newFocusIndex,
						offset: newFocusBlock.content.length,
					}),
				)
				.withDescription("Delete block")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
			dispatch({
				type: "SET_SELECTION",
				selection: createCollapsedSelection({
					blockIndex: newFocusIndex,
					offset: newFocusBlock.content.length,
				}),
			});
		},

		splitBlock: (index: number, offset: number) => {
			const s = get();
			const block = s.document.blocks[index];
			const beforeContent = block.content.substring(0, offset);
			const afterContent = block.content.substring(offset);
			const newBlockType =
				block.type === BlockType.bulletList ||
				block.type === BlockType.numberedList ||
				block.type === BlockType.checkboxList
					? block.type
					: BlockType.paragraph;
			const listLevel = getListLevel(block);
			const newBlock: BlockNode = {
				id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				type: newBlockType,
				content: afterContent,
				attributes:
					block.type === BlockType.checkboxList
						? { listLevel, checked: false }
						: newBlockType !== BlockType.paragraph
							? { listLevel }
							: {},
			};
			const transaction = new TransactionBuilder()
				.updateContent(index, block.content, beforeContent)
				.insertBlock(index + 1, newBlock)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: index + 1,
						offset: 0,
					}),
				)
				.withDescription("Split block")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		mergeWithPrevious: (index: number) => {
			if (index <= 0) return;
			const s = get();
			const currentBlock = s.document.blocks[index];
			const previousBlock = s.document.blocks[index - 1];
			if (
				currentBlock.type === BlockType.codeBlock ||
				previousBlock.type === BlockType.codeBlock ||
				previousBlock.type === BlockType.image ||
				previousBlock.type === BlockType.video
			)
				return;
			const mergedContent = previousBlock.content + currentBlock.content;
			const cursorOffset = previousBlock.content.length;
			const transaction = new TransactionBuilder()
				.updateContent(index - 1, previousBlock.content, mergedContent)
				.deleteBlock(index, currentBlock)
				.withSelectionBefore(s.selection)
				.withSelectionAfter(
					createCollapsedSelection({
						blockIndex: index - 1,
						offset: cursorOffset,
					}),
				)
				.withDescription("Merge blocks")
				.build();
			dispatch({ type: "APPLY_TRANSACTION", transaction });
		},

		loadMarkdown: (markdown: string) => {
			dispatch({
				type: "SET_DOCUMENT",
				document: createDocumentFromMarkdown(markdown),
			});
		},

		resetState: () => {
			history.clear();
			set({ ...initialEditorStateSlice });
		},

		toMarkdown: () => get().getContentForVersion(),
		prepareContent: () => {
			const state = get();
			const markdown = documentToMarkdown(state.document);
			set({
				preparedMarkdown: markdown,
				preparedVersion: state.document.version,
			});
		},
		getPreparedContent: () => {
			const { preparedMarkdown, preparedVersion } = get();
			if (preparedMarkdown == null || preparedVersion == null) {
				return null;
			}
			return {
				version: preparedVersion,
				markdown: preparedMarkdown,
			};
		},
		getContentForVersion: (version) => {
			const state = get();
			if (
				state.preparedMarkdown != null &&
				state.preparedVersion != null &&
				(version == null || state.preparedVersion === version)
			) {
				return state.preparedMarkdown;
			}
			return documentToMarkdown(state.document);
		},
		getContent: () => get().getContentForVersion(),

		getCanUndo: () => history.canUndo,
		getCanRedo: () => history.canRedo,
		getFocusedBlockIndex: () => get().selection?.focus.blockIndex ?? null,
		getFocusedBlock: () => {
			const state = get();
			const index = state.selection?.focus.blockIndex ?? null;
			return index !== null ? state.document.blocks[index] : null;
		},
		getHasBlockSelection: () => get().blockSelection !== null,
	};
});

export function useEditorSelection(): EditorStateSlice["selection"] {
	return useEditorState((s) => s.selection);
}

interface EditorBlockSelection {
	start: number;
	end: number;
}

export function useEditorBlockSelection(
	index: number,
): EditorBlockSelection | null {
	const cachedSelectionRef = useRef<DocumentSelection | null>(null);
	const cachedRangeRef = useRef<EditorBlockSelection | null>(null);

	const selector = useCallback(
		(s: EditorState) => {
			const selection = s.selection;
			if (
				!selection ||
				selection.anchor.blockIndex !== index ||
				selection.focus.blockIndex !== index
			) {
				cachedSelectionRef.current = null;
				cachedRangeRef.current = null;
				return null;
			}

			if (cachedSelectionRef.current === selection && cachedRangeRef.current) {
				return cachedRangeRef.current;
			}

			const start = Math.min(selection.anchor.offset, selection.focus.offset);
			const end = Math.max(selection.anchor.offset, selection.focus.offset);
			const cachedRange = cachedRangeRef.current;
			if (
				cachedRange &&
				cachedRange.start === start &&
				cachedRange.end === end
			) {
				cachedSelectionRef.current = selection;
				return cachedRange;
			}

			const nextRange = { start, end };
			cachedSelectionRef.current = selection;
			cachedRangeRef.current = nextRange;
			return nextRange;
		},
		[index],
	);

	return useEditorState(selector);
}

export function useEditorBlock(index: number): BlockNode | undefined {
	return useEditorState((s) => s.document.blocks[index]);
}

const BLOCK_ID_SEPARATOR = "\x01";

export function useEditorBlockIds(): string[] {
	const idsString = useEditorState((s) =>
		s.document.blocks.map((b) => b.id).join(BLOCK_ID_SEPARATOR),
	);
	return idsString ? idsString.split(BLOCK_ID_SEPARATOR) : [];
}
