import type { BlockNode } from "@/components/editor/core/BlockNode";
import type { Document } from "@/components/editor/core/Document";

export type EditorCommandId =
	| "focusPreviousBlock"
	| "focusNextBlock"
	| "undo"
	| "redo"
	| "toggleCheckbox"
	| "indentListItem"
	| "outdentListItem"
	| "deleteSelectedBlocks"
	| "selectAllBlocks"
	| "dismissOverlays";

export interface EditorCommandContext {
	isEditorActive: boolean;
	isWikiLinkModalOpen: boolean;
	getDocument: () => Document;
	getFocusedBlock: () => BlockNode | null;
	getFocusedBlockIndex: () => number | null;
	getHasBlockSelection: () => boolean;
	focusBlock: (index: number) => void;
	focusBlockAt: (index: number, offset: number) => void;
	runUndo: () => boolean;
	runRedo: () => boolean;
	runToggleCheckbox: () => boolean;
	runIndentListItem: () => boolean;
	runOutdentListItem: () => boolean;
	runDeleteSelectedBlocks: () => boolean;
	runSelectAllBlocks: () => boolean;
	runDismissOverlays: () => boolean;
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
	undo: (context) => context.runUndo(),
	redo: (context) => context.runRedo(),
	toggleCheckbox: (context) => context.runToggleCheckbox(),
	indentListItem: (context) => context.runIndentListItem(),
	outdentListItem: (context) => context.runOutdentListItem(),
	deleteSelectedBlocks: (context) => {
		if (!context.getHasBlockSelection()) return false;
		return context.runDeleteSelectedBlocks();
	},
	selectAllBlocks: (context) => context.runSelectAllBlocks(),
	dismissOverlays: (context) => context.runDismissOverlays(),
};

export function executeEditorCommand(
	commandId: EditorCommandId,
	context: EditorCommandContext,
): boolean {
	return editorCommands[commandId](context);
}
