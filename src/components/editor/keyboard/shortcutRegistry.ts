import type { EditorCommandId } from "./editorCommands";

const shortcutRegistry = new Map<string, EditorCommandId>([
	["Mod+Z", "undo"],
	["Mod+Shift+Z", "redo"],
	["Mod+Y", "redo"],
	["Ctrl+Y", "redo"],
	["Tab", "indentListItem"],
	["Shift+Tab", "outdentListItem"],
	["Escape", "dismissOverlays"],
	["Backspace", "deleteSelectedBlocks"],
	["Delete", "deleteSelectedBlocks"],
	["Mod+A", "selectAllBlocks"],
]);

export function getShortcutCommand(chord: string): EditorCommandId | null {
	return shortcutRegistry.get(chord) ?? null;
}
