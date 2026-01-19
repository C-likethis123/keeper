import { create } from 'zustand';
import { Document, createEmptyDocument, createDocumentFromMarkdown, documentToMarkdown } from './Document';
import { DocumentSelection, createStartSelection, createCollapsedSelection } from './Selection';
import { Transaction, TransactionBuilder, applyTransaction, isTransactionEmpty } from './Transaction';
import { History } from './History';
import { BlockNode, createParagraphBlock } from './BlockNode';
import { BlockType } from './BlockNode';

export interface BlockSelection {
  readonly start: number;
  readonly end: number;
}

interface EditorState {
  // Document state
  document: Document;
  selection: DocumentSelection;
  blockSelection: BlockSelection | null;
  focusedBlockIndex: number | null;

  // History
  history: History;

  // State flags
  isComposing: boolean; // For IME input

  // Actions
  setDocument: (document: Document) => void;
  setSelection: (selection: DocumentSelection) => void;
  setFocusedBlock: (index: number | null, preserveSelection?: boolean) => void;
  clearBlockSelection: () => void;
  selectBlock: (index: number) => void;
  selectBlockRange: (start: number, end: number) => void;
  selectAllBlocks: () => void;
  deleteSelectedBlocks: () => void;

  // Transaction operations
  applyTransaction: (transaction: Transaction) => void;
  undo: () => boolean;
  redo: () => boolean;

  // Convenience methods
  updateBlockContent: (index: number, newContent: string) => void;
  updateBlockType: (index: number, newType: BlockType, language?: string) => void;
  updateBlockListLevel: (index: number, newLevel: number) => void;
  insertBlockAfter: (index: number, block: BlockNode) => void;
  deleteBlock: (index: number) => void;
  splitBlock: (index: number, offset: number) => void;
  mergeWithPrevious: (index: number) => void;
  loadMarkdown: (markdown: string) => void;
  toMarkdown: () => string;

  // Computed getters (accessed via functions)
  getCanUndo: () => boolean;
  getCanRedo: () => boolean;
  getFocusedBlock: () => BlockNode | null;
  getHasBlockSelection: () => boolean;
}

export const useEditorState = create<EditorState>((set, get) => {
  const history = new History();

  return {
    // Initial state
    document: createEmptyDocument(),
    selection: createStartSelection(),
    blockSelection: null,
    focusedBlockIndex: null,
    history,
    isComposing: false,

    // Document management
    setDocument: (document: Document) => {
      set({
        document,
        selection: createStartSelection(),
        focusedBlockIndex: null,
      });
      history.clear();
    },

    setSelection: (selection: DocumentSelection) => {
      set({ selection });
    },

    setFocusedBlock: (index: number | null, preserveSelection = true) => {
      const state = get();
      if (state.focusedBlockIndex !== index) {
        if (index !== null && !preserveSelection) {
          const block = state.document.blocks[index];
          set({
            focusedBlockIndex: index,
            selection: createCollapsedSelection({
              blockIndex: index,
              offset: block.content.length,
            }),
          });
        } else {
          set({ focusedBlockIndex: index });
        }
      }
    },

    clearBlockSelection: () => {
      set({ blockSelection: null });
    },

    selectBlock: (index: number) => {
      set({
        blockSelection: { start: index, end: index },
        focusedBlockIndex: null,
      });
    },

    selectBlockRange: (start: number, end: number) => {
      const normalizedStart = Math.min(start, end);
      const normalizedEnd = Math.max(start, end);
      set({
        blockSelection: { start: normalizedStart, end: normalizedEnd },
        focusedBlockIndex: null,
      });
    },

    selectAllBlocks: () => {
      const state = get();
      if (state.document.blocks.length === 0) {
        return;
      }
      set({
        blockSelection: {
          start: 0,
          end: state.document.blocks.length - 1,
        },
        focusedBlockIndex: null,
      });
    },

    deleteSelectedBlocks: () => {
      const state = get();
      if (!state.blockSelection) {
        return;
      }

      const { start, end } = state.blockSelection;
      const oldBlocks = state.document.blocks.slice(start, end + 1);

      const transaction = new TransactionBuilder()
        .replaceBlocks(start, end + 1, oldBlocks, [createParagraphBlock()])
        .build();

      get().applyTransaction(transaction);
      get().clearBlockSelection();
    },

    // Transaction operations
    applyTransaction: (transaction: Transaction) => {
      if (isTransactionEmpty(transaction)) {
        return;
      }

      const state = get();
      state.history.push(transaction, state.document);

      const newDocument = applyTransaction(transaction, state.document);

      set({
        document: newDocument,
        selection: transaction.selectionAfter ?? state.selection,
      });
    },

    undo: () => {
      const state = get();
      const inverse = state.history.popUndo(state.document);
      if (!inverse) {
        return false;
      }

      const newDocument = applyTransaction(inverse, state.document);
      set({
        document: newDocument,
        selection: inverse.selectionAfter ?? state.selection,
      });

      return true;
    },

    redo: () => {
      const state = get();
      const transaction = state.history.popRedo(state.document);
      if (!transaction) {
        return false;
      }

      const newDocument = applyTransaction(transaction, state.document);
      set({
        document: newDocument,
        selection: transaction.selectionAfter ?? state.selection,
      });

      return true;
    },

    // Convenience methods
    updateBlockContent: (index: number, newContent: string) => {
      const state = get();
      const block = state.document.blocks[index];
      if (block.content === newContent) {
        return;
      }

      const transaction = new TransactionBuilder()
        .updateContent(index, block.content, newContent)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(
          createCollapsedSelection({
            blockIndex: index,
            offset: newContent.length,
          }),
        )
        .withDescription('Update content')
        .build();

      get().applyTransaction(transaction);
    },

    updateBlockType: (index: number, newType: BlockType, language?: string) => {
      const state = get();
      const block = state.document.blocks[index];
      if (block.type === newType) {
        return;
      }

      const transaction = new TransactionBuilder()
        .updateType(index, block.type, newType, block.language, language)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(state.selection)
        .withDescription('Change block type')
        .build();

      get().applyTransaction(transaction);
    },

    updateBlockListLevel: (index: number, newLevel: number) => {
      const state = get();
      const block = state.document.blocks[index];
      if (block.listLevel === newLevel) {
        return;
      }

      const transaction = new TransactionBuilder()
        .updateListLevel(index, block.listLevel, newLevel)
        .withDescription('Update list level')
        .build();

      get().applyTransaction(transaction);
    },

    insertBlockAfter: (index: number, block: BlockNode) => {
      const state = get();
      const transaction = new TransactionBuilder()
        .insertBlock(index + 1, block)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(
          createCollapsedSelection({
            blockIndex: index + 1,
            offset: 0,
          }),
        )
        .withDescription('Insert block')
        .build();

      get().applyTransaction(transaction);
    },

    deleteBlock: (index: number) => {
      const state = get();
      if (state.document.blocks.length <= 1) {
        // Don't delete the last block, just clear it
        get().updateBlockType(index, BlockType.paragraph);
        get().updateBlockContent(index, '');
        return;
      }

      const block = state.document.blocks[index];
      const newFocusIndex = index > 0 ? index - 1 : 0;
      const newFocusBlock =
        index > 0
          ? state.document.blocks[index - 1]
          : state.document.blocks[1];

      const transaction = new TransactionBuilder()
        .deleteBlock(index, block)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(
          createCollapsedSelection({
            blockIndex: newFocusIndex,
            offset: newFocusBlock.content.length,
          }),
        )
        .withDescription('Delete block')
        .build();

      get().applyTransaction(transaction);
      get().setFocusedBlock(newFocusIndex);
    },

    splitBlock: (index: number, offset: number) => {
      const state = get();
      const block = state.document.blocks[index];
      const beforeContent = block.content.substring(0, offset);
      const afterContent = block.content.substring(offset);

      // Determine the type for the new block
      const newBlockType =
        block.type === BlockType.bulletList || block.type === BlockType.numberedList
          ? block.type
          : BlockType.paragraph;

      const newBlock: BlockNode = {
        id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: newBlockType,
        content: afterContent,
        listLevel: block.listLevel,
        attributes: {},
      };

      const transaction = new TransactionBuilder()
        .updateContent(index, block.content, beforeContent)
        .insertBlock(index + 1, newBlock)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(
          createCollapsedSelection({
            blockIndex: index + 1,
            offset: 0,
          }),
        )
        .withDescription('Split block')
        .build();

      get().applyTransaction(transaction);
    },

    mergeWithPrevious: (index: number) => {
      if (index <= 0) {
        return;
      }

      const state = get();
      const currentBlock = state.document.blocks[index];
      const previousBlock = state.document.blocks[index - 1];

      // Can't merge into a code block
      if (currentBlock.type === BlockType.codeBlock || previousBlock.type === BlockType.codeBlock) {
        return;
      }

      const mergedContent = previousBlock.content + currentBlock.content;
      const cursorOffset = previousBlock.content.length;

      const transaction = new TransactionBuilder()
        .updateContent(index - 1, previousBlock.content, mergedContent)
        .deleteBlock(index, currentBlock)
        .withSelectionBefore(state.selection)
        .withSelectionAfter(
          createCollapsedSelection({
            blockIndex: index - 1,
            offset: cursorOffset,
          }),
        )
        .withDescription('Merge blocks')
        .build();

      get().applyTransaction(transaction);
    },

    loadMarkdown: (markdown: string) => {
      get().setDocument(createDocumentFromMarkdown(markdown));
    },

    toMarkdown: () => {
      return documentToMarkdown(get().document);
    },

    // Computed getters
    getCanUndo: () => {
      return get().history.canUndo;
    },

    getCanRedo: () => {
      return get().history.canRedo;
    },

    getFocusedBlock: () => {
      const state = get();
      return state.focusedBlockIndex !== null
        ? state.document.blocks[state.focusedBlockIndex]
        : null;
    },

    getHasBlockSelection: () => {
      return get().blockSelection !== null;
    },
  };
});

