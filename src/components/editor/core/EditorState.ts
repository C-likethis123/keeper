import type { BlockNode, BlockType } from "./BlockNode";
import { type Document, createEmptyDocument } from "./Document";
import type { History } from "./History";
import type { DocumentSelection } from "./Selection";
import {
	type Transaction,
	applyTransaction,
	isTransactionEmpty,
} from "./Transaction";

export interface BlockSelection {
	readonly start: number;
	readonly end: number;
}

export interface GapSelection {
	readonly index: number;
}

export interface EditorStateSlice {
	document: Document;
	selection: DocumentSelection | null;
	blockSelection: BlockSelection | null;
	blockSelectionAnchor: number | null;
	gapSelection: GapSelection | null;
	isComposing: boolean;
	preparedMarkdown: string | null;
	preparedVersion: number | null;
}

export interface EditorState extends EditorStateSlice {
	setDocument: (document: Document) => void;
	setSelection: (selection: DocumentSelection | null) => void;
	clearBlockSelection: () => void;
	clearStructuredSelection: () => void;
	selectBlock: (index: number) => void;
	selectBlockRange: (anchor: number, focus: number) => void;
	selectGap: (index: number) => void;
	selectAllBlocks: () => void;
	deleteSelectedBlocks: () => void;
	applyTransaction: (transaction: Transaction) => void;
	undo: () => boolean;
	redo: () => boolean;
	updateBlockContent: (
		index: number,
		newContent: string,
		selectionOffset?: number,
	) => void;
	updateBlockType: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	updateBlockListLevel: (index: number, newLevel: number) => void;
	updateBlockAttributes: (
		index: number,
		newAttrs: Record<string, unknown>,
	) => void;
	toggleCheckbox: (index: number) => void;
	toggleInlineStyle: (marker: string) => boolean;
	toggleCurrentBlockType: (targetType: BlockType) => boolean;
	insertSoftLineBreak: () => boolean;
	insertBlockAfter: (index: number, block: BlockNode) => void;
	deleteBlock: (index: number) => void;
	splitBlock: (index: number, offset: number) => void;
	mergeWithPrevious: (index: number) => void;
	loadMarkdown: (markdown: string) => void;
	toMarkdown: () => string;
	prepareContent: () => void;
	getPreparedContent: () => { version: number; markdown: string } | null;
	getContentForVersion: (version?: number) => string;
	getCanUndo: () => boolean;
	getCanRedo: () => boolean;
	getFocusedBlockIndex: () => number | null;
	getFocusedBlock: () => BlockNode | null;
	getHasBlockSelection: () => boolean;
	getContent: () => string;
	resetState: () => void;
}

export const initialEditorStateSlice: EditorStateSlice = {
	document: createEmptyDocument(),
	selection: null,
	blockSelection: null,
	blockSelectionAnchor: null,
	gapSelection: null,
	isComposing: false,
	preparedMarkdown: null,
	preparedVersion: null,
};

type EditorAction =
	| { type: "SET_DOCUMENT"; document: Document }
	| { type: "SET_SELECTION"; selection: DocumentSelection | null }
	| { type: "CLEAR_BLOCK_SELECTION" }
	| { type: "CLEAR_STRUCTURED_SELECTION" }
	| { type: "SELECT_BLOCK"; index: number }
	| { type: "SELECT_BLOCK_RANGE"; anchor: number; focus: number }
	| { type: "SELECT_GAP"; index: number }
	| { type: "SELECT_ALL_BLOCKS" }
	| { type: "APPLY_TRANSACTION"; transaction: Transaction }
	| { type: "UNDO" }
	| { type: "REDO" };

export function editorReducer(
	state: EditorStateSlice,
	action: EditorAction,
	history: History,
): EditorStateSlice {
	switch (action.type) {
		case "SET_DOCUMENT":
			history.clear();
			return {
				...state,
				document: action.document,
				selection: null,
				blockSelection: null,
				blockSelectionAnchor: null,
				gapSelection: null,
			};

		case "SET_SELECTION":
			return {
				...state,
				selection: action.selection,
				blockSelection: null,
				blockSelectionAnchor: null,
				gapSelection: null,
			};

		case "CLEAR_BLOCK_SELECTION":
			return {
				...state,
				blockSelection: null,
				blockSelectionAnchor: null,
			};

		case "CLEAR_STRUCTURED_SELECTION":
			return {
				...state,
				selection: null,
				blockSelection: null,
				blockSelectionAnchor: null,
				gapSelection: null,
			};

		case "SELECT_BLOCK":
			return {
				...state,
				blockSelection: { start: action.index, end: action.index },
				blockSelectionAnchor: action.index,
				selection: null,
				gapSelection: null,
			};

		case "SELECT_BLOCK_RANGE": {
			const start = Math.min(action.anchor, action.focus);
			const end = Math.max(action.anchor, action.focus);
			return {
				...state,
				blockSelection: { start, end },
				blockSelectionAnchor: action.anchor,
				selection: null,
				gapSelection: null,
			};
		}

		case "SELECT_GAP":
			return {
				...state,
				gapSelection: { index: action.index },
				selection: null,
				blockSelection: null,
				blockSelectionAnchor: null,
			};

		case "SELECT_ALL_BLOCKS":
			if (state.document.blocks.length === 0) return state;
			return {
				...state,
				blockSelection: { start: 0, end: state.document.blocks.length - 1 },
				blockSelectionAnchor: 0,
				selection: null,
				gapSelection: null,
			};

		case "APPLY_TRANSACTION": {
			const { transaction } = action;
			if (isTransactionEmpty(transaction)) return state;
			history.push(transaction, state.document);
			const newDocument = applyTransaction(transaction, state.document);
			return {
				...state,
				document: newDocument,
				selection:
					transaction.selectionAfter !== undefined
						? transaction.selectionAfter
						: state.selection,
			};
		}

		case "UNDO": {
			const inverse = history.popUndo(state.document);
			if (!inverse) return state;
			const newDocument = applyTransaction(inverse, state.document);
			return {
				...state,
				document: newDocument,
				selection:
					inverse.selectionAfter !== undefined
						? inverse.selectionAfter
						: state.selection,
			};
		}

		case "REDO": {
			const transaction = history.popRedo(state.document);
			if (!transaction) return state;
			const newDocument = applyTransaction(transaction, state.document);
			return {
				...state,
				document: newDocument,
				selection:
					transaction.selectionAfter !== undefined
						? transaction.selectionAfter
						: state.selection,
			};
		}

		default:
			return state;
	}
}

type EditorActionType = EditorAction["type"];
