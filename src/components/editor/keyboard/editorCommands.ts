import type { BlockNode } from "@/components/editor/core/BlockNode";
import type { Document } from "@/components/editor/core/Document";

export type EditorCommandId =
	| "focusPreviousBlock"
	| "focusNextBlock"
	| "undo"
	| "redo"
	| "toggleBold"
	| "toggleItalic"
	| "toggleHeading1"
	| "toggleHeading2"
	| "toggleHeading3"
	| "toggleBulletList"
	| "toggleNumberedList"
	| "toggleCheckboxList"
	| "toggleCheckbox"
	| "insertSoftLineBreak"
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
	runToggleBold: () => boolean;
	runToggleItalic: () => boolean;
	runToggleHeading1: () => boolean;
	runToggleHeading2: () => boolean;
	runToggleHeading3: () => boolean;
	runToggleBulletList: () => boolean;
	runToggleNumberedList: () => boolean;
	runToggleCheckboxList: () => boolean;
	runToggleCheckbox: () => boolean;
	runInsertSoftLineBreak: () => boolean;
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
	toggleBold: (context) => context.runToggleBold(),
	toggleItalic: (context) => context.runToggleItalic(),
	toggleHeading1: (context) => context.runToggleHeading1(),
	toggleHeading2: (context) => context.runToggleHeading2(),
	toggleHeading3: (context) => context.runToggleHeading3(),
	toggleBulletList: (context) => context.runToggleBulletList(),
	toggleNumberedList: (context) => context.runToggleNumberedList(),
	toggleCheckboxList: (context) => context.runToggleCheckboxList(),
	toggleCheckbox: (context) => context.runToggleCheckbox(),
	insertSoftLineBreak: (context) => context.runInsertSoftLineBreak(),
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
