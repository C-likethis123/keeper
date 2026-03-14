import type { BlockNode } from "@/components/editor/core/BlockNode";
import type { Document } from "@/components/editor/core/Document";

export type EditorCommandId =
	| "focusPreviousBlock"
	| "focusNextBlock"
	| "undo"
	| "redo"
	| "indentListItem"
	| "outdentListItem"
	| "deleteSelectedBlocks"
	| "selectAllBlocks"
	| "dismissOverlays";

export interface EditorCommandContext {
	isEditorActive: boolean;
	isReadOnly: boolean;
	isWikiLinkModalOpen: boolean;
	getDocument: () => Document;
	getFocusedBlock: () => BlockNode | null;
	getFocusedBlockIndex: () => number | null;
	getHasBlockSelection: () => boolean;
	focusBlock: (index: number) => void;
	focusBlockAt: (index: number, offset: number) => void;
	undo: () => boolean;
	redo: () => boolean;
	indentListItem: () => boolean;
	outdentListItem: () => boolean;
	deleteSelectedBlocks: () => boolean;
	selectAllBlocks: () => boolean;
	dismissOverlays: () => boolean;
}

type EditorCommand = (context: EditorCommandContext) => boolean;

export const editorCommands: Record<EditorCommandId, EditorCommand> = {
	focusPreviousBlock: (context) => {
		const index = context.getFocusedBlockIndex();
		if (index === null || index <= 0) return false;
		context.focusBlock(index - 1);
		return true;
	},
	focusNextBlock: (context) => {
		const index = context.getFocusedBlockIndex();
		const blockCount = context.getDocument().blocks.length;
		if (index === null || index >= blockCount - 1) return false;
		context.focusBlock(index + 1);
		return true;
	},
	undo: (context) => {
		if (context.isReadOnly) return false;
		return context.undo();
	},
	redo: (context) => {
		if (context.isReadOnly) return false;
		return context.redo();
	},
	indentListItem: (context) => {
		if (context.isReadOnly) return false;
		return context.indentListItem();
	},
	outdentListItem: (context) => {
		if (context.isReadOnly) return false;
		return context.outdentListItem();
	},
	deleteSelectedBlocks: (context) => {
		if (context.isReadOnly || !context.getHasBlockSelection()) return false;
		return context.deleteSelectedBlocks();
	},
	selectAllBlocks: (context) => context.selectAllBlocks(),
	dismissOverlays: (context) => context.dismissOverlays(),
};

export function executeEditorCommand(
	commandId: EditorCommandId,
	context: EditorCommandContext,
): boolean {
	return editorCommands[commandId](context);
}
