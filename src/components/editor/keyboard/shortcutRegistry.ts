import type { EditorCommandId } from "./editorCommands";

const shortcutRegistry = new Map<string, EditorCommandId>([
	["Meta+Z", "undo"],
	["Ctrl+Z", "undo"],
	["Meta+Shift+Z", "redo"],
	["Ctrl+Shift+Z", "redo"],
	["Ctrl+Y", "redo"],
	["Meta+B", "toggleBold"],
	["Ctrl+B", "toggleBold"],
	["Meta+I", "toggleItalic"],
	["Ctrl+I", "toggleItalic"],
	["Meta+Alt+1", "toggleHeading1"],
	["Ctrl+Alt+1", "toggleHeading1"],
	["Meta+Alt+2", "toggleHeading2"],
	["Ctrl+Alt+2", "toggleHeading2"],
	["Meta+Alt+3", "toggleHeading3"],
	["Ctrl+Alt+3", "toggleHeading3"],
	["Meta+Shift+7", "toggleNumberedList"],
	["Ctrl+Shift+7", "toggleNumberedList"],
	["Meta+Shift+8", "toggleBulletList"],
	["Ctrl+Shift+8", "toggleBulletList"],
	["Meta+Shift+9", "toggleCheckboxList"],
	["Ctrl+Shift+9", "toggleCheckboxList"],
	["Meta+Enter", "toggleCheckbox"],
	["Ctrl+Enter", "toggleCheckbox"],
	["Shift+Enter", "insertSoftLineBreak"],
	["Tab", "indentListItem"],
	["Shift+Tab", "outdentListItem"],
	["Escape", "dismissOverlays"],
	["Backspace", "deleteSelectedBlocks"],
	["Delete", "deleteSelectedBlocks"],
	["Meta+A", "selectAllBlocks"],
	["Ctrl+A", "selectAllBlocks"],
]);

export function getShortcutCommand(chord: string): EditorCommandId | null {
	return shortcutRegistry.get(chord) ?? null;
}
