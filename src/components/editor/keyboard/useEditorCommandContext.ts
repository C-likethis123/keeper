import {
	BlockType,
	getListLevel,
	isListItem,
} from "@/components/editor/core/BlockNode";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorState } from "@/stores/editorStore";
import { useMemo } from "react";
import type { EditorCommandContext } from "./editorCommands";

interface UseEditorCommandContextOptions {
	isEditorActive: boolean;
	isWikiLinkModalOpen: boolean;
	dismissOverlays: () => boolean;
}

export function useEditorCommandContext(
	options: UseEditorCommandContextOptions,
): EditorCommandContext {
	const document = useEditorState((state) => state.document);
	const getFocusedBlockIndex = useEditorState((state) => state.getFocusedBlockIndex);
	const getFocusedBlock = useEditorState((state) => state.getFocusedBlock);
	const getHasBlockSelection = useEditorState((state) => state.getHasBlockSelection);
	const updateBlockListLevel = useEditorState((state) => state.updateBlockListLevel);
	const updateBlockType = useEditorState((state) => state.updateBlockType);
	const toggleCheckbox = useEditorState((state) => state.toggleCheckbox);
	const deleteSelectedBlocksFromStore = useEditorState(
		(state) => state.deleteSelectedBlocks,
	);
	const selectAllBlocksFromStore = useEditorState(
		(state) => state.selectAllBlocks,
	);
	const undoFromStore = useEditorState((state) => state.undo);
	const redoFromStore = useEditorState((state) => state.redo);
	const { focusBlock, focusBlockAt } = useFocusBlock();

	return useMemo(
		() => ({
			isEditorActive: options.isEditorActive,
			isWikiLinkModalOpen: options.isWikiLinkModalOpen,
			getDocument: () => document,
			getFocusedBlock,
			getFocusedBlockIndex,
			getHasBlockSelection,
			focusBlock,
			focusBlockAt,
			runUndo: () => undoFromStore(),
			runRedo: () => redoFromStore(),
			runToggleCheckbox: () => {
				const index = getFocusedBlockIndex();
				if (index === null) return false;
				const block = document.blocks[index];
				if (!block || block.type !== BlockType.checkboxList) return false;
				toggleCheckbox(index);
				return true;
			},
			runIndentListItem: () => {
				const index = getFocusedBlockIndex();
				if (index === null) return false;
				const block = document.blocks[index];
				if (!block || !isListItem(block.type)) return false;
				updateBlockListLevel(index, getListLevel(block) + 1);
				return true;
			},
			runOutdentListItem: () => {
				const index = getFocusedBlockIndex();
				if (index === null) return false;
				const block = document.blocks[index];
				if (!block || !isListItem(block.type)) return false;

				if (getListLevel(block) > 0) {
					updateBlockListLevel(index, getListLevel(block) - 1);
				} else {
					updateBlockType(index, BlockType.paragraph);
					focusBlock(index);
				}
				return true;
			},
			runDeleteSelectedBlocks: () => {
				if (!getHasBlockSelection()) return false;
				deleteSelectedBlocksFromStore();
				return true;
			},
			runSelectAllBlocks: () => {
				selectAllBlocksFromStore();
				return true;
			},
			runDismissOverlays: options.dismissOverlays,
		}),
		[
			deleteSelectedBlocksFromStore,
			document,
			focusBlock,
			focusBlockAt,
			getFocusedBlock,
			getFocusedBlockIndex,
			getHasBlockSelection,
			options.dismissOverlays,
			options.isEditorActive,
			options.isWikiLinkModalOpen,
			redoFromStore,
			selectAllBlocksFromStore,
			toggleCheckbox,
			undoFromStore,
			updateBlockListLevel,
			updateBlockType,
		],
	);
}
