import { Document, createEmptyDocument, createDocumentFromMarkdown, documentToMarkdown } from './Document';
import { DocumentSelection, createCollapsedSelection } from './Selection';
import { Transaction, TransactionBuilder, applyTransaction, isTransactionEmpty } from './Transaction';
import { History } from './History';
import { BlockNode, createParagraphBlock } from './BlockNode';
import { BlockType } from './BlockNode';

export interface BlockSelection {
  readonly start: number;
  readonly end: number;
}

export interface EditorStateSlice {
  document: Document;
  selection: DocumentSelection | null;
  blockSelection: BlockSelection | null;
  isComposing: boolean;
}

export interface EditorState extends EditorStateSlice {
  setDocument: (document: Document) => void;
  setSelection: (selection: DocumentSelection | null) => void;
  clearBlockSelection: () => void;
  selectBlock: (index: number) => void;
  selectBlockRange: (start: number, end: number) => void;
  selectAllBlocks: () => void;
  deleteSelectedBlocks: () => void;
  applyTransaction: (transaction: Transaction) => void;
  undo: () => boolean;
  redo: () => boolean;
  updateBlockContent: (index: number, newContent: string) => void;
  updateBlockType: (index: number, newType: BlockType, language?: string) => void;
  updateBlockListLevel: (index: number, newLevel: number) => void;
  insertBlockAfter: (index: number, block: BlockNode) => void;
  deleteBlock: (index: number) => void;
  splitBlock: (index: number, offset: number) => void;
  mergeWithPrevious: (index: number) => void;
  loadMarkdown: (markdown: string) => void;
  toMarkdown: () => string;
  getCanUndo: () => boolean;
  getCanRedo: () => boolean;
  getFocusedBlockIndex: () => number | null;
  getFocusedBlock: () => BlockNode | null;
  getHasBlockSelection: () => boolean;
}

export const initialEditorStateSlice: EditorStateSlice = {
  document: createEmptyDocument(),
  selection: null,
  blockSelection: null,
  isComposing: false,
};

type EditorAction =
  | { type: 'SET_DOCUMENT'; document: Document }
  | { type: 'SET_SELECTION'; selection: DocumentSelection | null }
  | { type: 'CLEAR_BLOCK_SELECTION' }
  | { type: 'SELECT_BLOCK'; index: number }
  | { type: 'SELECT_BLOCK_RANGE'; start: number; end: number }
  | { type: 'SELECT_ALL_BLOCKS' }
  | { type: 'APPLY_TRANSACTION'; transaction: Transaction }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export function editorReducer(
  state: EditorStateSlice,
  action: EditorAction,
  history: History,
): EditorStateSlice {
  switch (action.type) {
    case 'SET_DOCUMENT':
      history.clear();
      return {
        ...state,
        document: action.document,
        selection: null,
      };

    case 'SET_SELECTION':
      return { ...state, selection: action.selection };

    case 'CLEAR_BLOCK_SELECTION':
      return { ...state, blockSelection: null };

    case 'SELECT_BLOCK':
      return {
        ...state,
        blockSelection: { start: action.index, end: action.index },
        selection: null,
      };

    case 'SELECT_BLOCK_RANGE': {
      const start = Math.min(action.start, action.end);
      const end = Math.max(action.start, action.end);
      return {
        ...state,
        blockSelection: { start, end },
        selection: null,
      };
    }

    case 'SELECT_ALL_BLOCKS':
      if (state.document.blocks.length === 0) return state;
      return {
        ...state,
        blockSelection: { start: 0, end: state.document.blocks.length - 1 },
        selection: null,
      };

    case 'APPLY_TRANSACTION': {
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

    case 'UNDO': {
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

    case 'REDO': {
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

export type EditorActionType = EditorAction['type'];
