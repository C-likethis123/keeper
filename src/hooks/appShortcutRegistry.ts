type AppCommandId = "focusSearch" | "createNote" | "forceSave";

const appShortcutRegistry = new Map<string, AppCommandId>([
	["Meta+K", "focusSearch"],
	["Ctrl+K", "focusSearch"],
	["Meta+P", "focusSearch"],
	["Ctrl+P", "focusSearch"],
	["Meta+N", "createNote"],
	["Ctrl+N", "createNote"],
	["Meta+S", "forceSave"],
	["Ctrl+S", "forceSave"],
]);

export function getAppShortcutCommand(chord: string): AppCommandId | null {
	return appShortcutRegistry.get(chord) ?? null;
}
