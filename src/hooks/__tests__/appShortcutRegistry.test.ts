import { getAppShortcutCommand } from "../appShortcutRegistry";

describe("appShortcutRegistry", () => {
	it("maps Cmd/Ctrl+K to focusSearch", () => {
		expect(getAppShortcutCommand("Meta+K")).toBe("focusSearch");
		expect(getAppShortcutCommand("Ctrl+K")).toBe("focusSearch");
	});

	it("maps Cmd/Ctrl+N to createNote", () => {
		expect(getAppShortcutCommand("Meta+N")).toBe("createNote");
		expect(getAppShortcutCommand("Ctrl+N")).toBe("createNote");
	});

	it("maps Cmd/Ctrl+P to focusSearch", () => {
		expect(getAppShortcutCommand("Meta+P")).toBe("focusSearch");
		expect(getAppShortcutCommand("Ctrl+P")).toBe("focusSearch");
	});

	it("maps Cmd/Ctrl+S to forceSave", () => {
		expect(getAppShortcutCommand("Meta+S")).toBe("forceSave");
		expect(getAppShortcutCommand("Ctrl+S")).toBe("forceSave");
	});

	it("returns null for chords already owned by the editor", () => {
		expect(getAppShortcutCommand("Meta+Z")).toBeNull();
		expect(getAppShortcutCommand("Ctrl+B")).toBeNull();
		expect(getAppShortcutCommand("Meta+I")).toBeNull();
	});

	it("returns null for unrecognized chords", () => {
		expect(getAppShortcutCommand("Meta+Q")).toBeNull();
		expect(getAppShortcutCommand("Ctrl+X")).toBeNull();
		expect(getAppShortcutCommand("A")).toBeNull();
	});
});
