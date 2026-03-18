import type { EditorCommandId } from "./editorCommands";

const shortcutRegistry = new Map<string, EditorCommandId>([
	["Meta+Z", "undo"],
	["Ctrl+Z", "undo"],
	["Meta+Shift+Z", "redo"],
	["Ctrl+Shift+Z", "redo"],
	["Ctrl+Y", "redo"],
	["Meta+Enter", "toggleCheckbox"],
	["Ctrl+Enter", "toggleCheckbox"],
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
