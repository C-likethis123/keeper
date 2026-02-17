import { BlockNode, BlockType, createParagraphBlock } from '@/components/editor/core/BlockNode';
import { Document, createDocumentFromMarkdown, createEmptyDocument, documentToMarkdown } from '@/components/editor/core/Document';
import {
  editorReducer,
  initialEditorStateSlice,
  type EditorState,
  type EditorStateSlice,
} from '@/components/editor/core/EditorState';
import { History } from '@/components/editor/core/History';
import { createCollapsedSelection } from '@/components/editor/core/Selection';
import { Transaction, TransactionBuilder } from '@/components/editor/core/Transaction';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';

// TODO: Refactor
const EditorStateContext = createContext<EditorState | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const historyRef = useRef(new History());
  const stateRef = useRef<EditorStateSlice>(initialEditorStateSlice);

  const reducer = useCallback(
    (state: EditorStateSlice, action: Parameters<typeof editorReducer>[1]) =>
      editorReducer(state, action, historyRef.current),
    [],
  );

  const [state, dispatch] = useReducer(reducer, initialEditorStateSlice);
  stateRef.current = state;

  const actions = useMemo(() => {
    return {
      setDocument: (document: Document) => dispatch({ type: 'SET_DOCUMENT', document }),

      setSelection: (selection: EditorStateSlice['selection']) =>
        dispatch({ type: 'SET_SELECTION', selection }),

      clearBlockSelection: () => dispatch({ type: 'CLEAR_BLOCK_SELECTION' }),

      selectBlock: (index: number) => dispatch({ type: 'SELECT_BLOCK', index }),

      selectBlockRange: (start: number, end: number) =>
        dispatch({ type: 'SELECT_BLOCK_RANGE', start, end }),

      selectAllBlocks: () => dispatch({ type: 'SELECT_ALL_BLOCKS' }),

      deleteSelectedBlocks: () => {
        const s = stateRef.current;
        if (!s.blockSelection) return;
        const { start, end } = s.blockSelection;
        const oldBlocks = s.document.blocks.slice(start, end + 1);
        const transaction = new TransactionBuilder()
          .replaceBlocks(start, end + 1, oldBlocks, [createParagraphBlock()])
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
        dispatch({ type: 'CLEAR_BLOCK_SELECTION' });
      },

      applyTransaction: (transaction: Transaction) =>
        dispatch({ type: 'APPLY_TRANSACTION', transaction }),

      undo: () => {
        if (!historyRef.current.canUndo) return false;
        dispatch({ type: 'UNDO' });
        return true;
      },

      redo: () => {
        if (!historyRef.current.canRedo) return false;
        dispatch({ type: 'REDO' });
        return true;
      },

      updateBlockContent: (index: number, newContent: string) => {
        const s = stateRef.current;
        const block = s.document.blocks[index];
        if (block.content === newContent) return;
        const transaction = new TransactionBuilder()
          .updateContent(index, block.content, newContent)
          .withSelectionBefore(s.selection)
          .withSelectionAfter(
            createCollapsedSelection({
              blockIndex: index,
              offset: newContent.length,
            }),
          )
          .withDescription('Update content')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      updateBlockType: (index: number, newType: BlockType, language?: string) => {
        const s = stateRef.current;
        const block = s.document.blocks[index];
        if (block.type === newType && block.language === language) return;
        const transaction = new TransactionBuilder()
          .updateType(index, block.type, newType, block.language, language)
          .withSelectionBefore(s.selection)
          .withSelectionAfter(s.selection)
          .withDescription('Change block type')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      updateBlockListLevel: (index: number, newLevel: number) => {
        const s = stateRef.current;
        const block = s.document.blocks[index];
        if (block.listLevel === newLevel) return;
        const transaction = new TransactionBuilder()
          .updateListLevel(index, block.listLevel, newLevel)
          .withDescription('Update list level')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      insertBlockAfter: (index: number, block: BlockNode) => {
        const s = stateRef.current;
        const transaction = new TransactionBuilder()
          .insertBlock(index + 1, block)
          .withSelectionBefore(s.selection)
          .withSelectionAfter(
            createCollapsedSelection({
              blockIndex: index + 1,
              offset: 0,
            }),
          )
          .withDescription('Insert block')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      deleteBlock: (index: number) => {
        const s = stateRef.current;
        if (s.document.blocks.length <= 1) {
          dispatch({ type: 'SET_DOCUMENT', document: createEmptyDocument() });
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
          .withDescription('Delete block')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
        dispatch({
          type: 'SET_SELECTION',
          selection: createCollapsedSelection({
            blockIndex: newFocusIndex,
            offset: newFocusBlock.content.length,
          }),
        });
      },

      splitBlock: (index: number, offset: number) => {
        const s = stateRef.current;
        const block = s.document.blocks[index];
        const beforeContent = block.content.substring(0, offset);
        const afterContent = block.content.substring(offset);
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
          .withSelectionBefore(s.selection)
          .withSelectionAfter(
            createCollapsedSelection({
              blockIndex: index + 1,
              offset: 0,
            }),
          )
          .withDescription('Split block')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      mergeWithPrevious: (index: number) => {
        if (index <= 0) return;
        const s = stateRef.current;
        const currentBlock = s.document.blocks[index];
        const previousBlock = s.document.blocks[index - 1];
        if (
          currentBlock.type === BlockType.codeBlock ||
          previousBlock.type === BlockType.codeBlock ||
          previousBlock.type === BlockType.image
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
          .withDescription('Merge blocks')
          .build();
        dispatch({ type: 'APPLY_TRANSACTION', transaction });
      },

      loadMarkdown: (markdown: string) => {
        dispatch({
          type: 'SET_DOCUMENT',
          document: createDocumentFromMarkdown(markdown),
        });
      },

      toMarkdown: () => documentToMarkdown(stateRef.current.document),

      getCanUndo: () => historyRef.current.canUndo,
      getCanRedo: () => historyRef.current.canRedo,
      getFocusedBlockIndex: () =>
        stateRef.current.selection?.focus.blockIndex ?? null,
      getFocusedBlock: () => {
        const s = stateRef.current;
        const index = s.selection?.focus.blockIndex ?? null;
        return index !== null ? s.document.blocks[index] : null;
      },
      getHasBlockSelection: () => stateRef.current.blockSelection !== null,
    };
  }, []);

  const value = useMemo<EditorState>(
    () => ({ ...state, ...actions }),
    [state, actions],
  );

  return (
    <EditorStateContext.Provider value={value}>
      {children}
    </EditorStateContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const ctx = useContext(EditorStateContext);
  if (!ctx) {
    throw new Error('useEditorState must be used within EditorProvider');
  }
  return ctx;
}
