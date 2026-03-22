import { getShortcutCommand } from "../shortcutRegistry";

describe("shortcutRegistry", () => {
	it("maps formatting shortcuts to editor commands", () => {
		expect(getShortcutCommand("Meta+B")).toBe("toggleBold");
		expect(getShortcutCommand("Ctrl+I")).toBe("toggleItalic");
		expect(getShortcutCommand("Meta+Alt+1")).toBe("toggleHeading1");
		expect(getShortcutCommand("Ctrl+Alt+2")).toBe("toggleHeading2");
		expect(getShortcutCommand("Meta+Shift+7")).toBe("toggleNumberedList");
		expect(getShortcutCommand("Ctrl+Shift+8")).toBe("toggleBulletList");
		expect(getShortcutCommand("Meta+Shift+9")).toBe("toggleCheckboxList");
	});
});
