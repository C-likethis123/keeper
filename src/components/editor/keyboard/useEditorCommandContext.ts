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
	isReadOnly: boolean;
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
	const deleteSelectedBlocks = useEditorState((state) => state.deleteSelectedBlocks);
	const selectAllBlocks = useEditorState((state) => state.selectAllBlocks);
	const undo = useEditorState((state) => state.undo);
	const redo = useEditorState((state) => state.redo);
	const { focusBlock, focusBlockAt } = useFocusBlock();

	return useMemo(
		() => ({
			isEditorActive: options.isEditorActive,
			isReadOnly: options.isReadOnly,
			isWikiLinkModalOpen: options.isWikiLinkModalOpen,
			getDocument: () => document,
			getFocusedBlock,
			getFocusedBlockIndex,
			getHasBlockSelection,
			focusBlock,
			focusBlockAt,
			undo,
			redo,
			indentListItem: () => {
				const index = getFocusedBlockIndex();
				if (index === null) return false;
				const block = document.blocks[index];
				if (!block || !isListItem(block.type)) return false;
				updateBlockListLevel(index, getListLevel(block) + 1);
				return true;
			},
			outdentListItem: () => {
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
			deleteSelectedBlocks: () => {
				if (!getHasBlockSelection()) return false;
				deleteSelectedBlocks();
				return true;
			},
			selectAllBlocks: () => {
				selectAllBlocks();
				return true;
			},
			dismissOverlays: options.dismissOverlays,
		}),
		[
			deleteSelectedBlocks,
			document,
			focusBlock,
			focusBlockAt,
			getFocusedBlock,
			getFocusedBlockIndex,
			getHasBlockSelection,
			options.dismissOverlays,
			options.isEditorActive,
			options.isReadOnly,
			options.isWikiLinkModalOpen,
			redo,
			selectAllBlocks,
			undo,
			updateBlockListLevel,
			updateBlockType,
		],
	);
}
