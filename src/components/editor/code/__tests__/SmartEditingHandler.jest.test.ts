import { SmartEditingHandler } from "@/components/editor/code/SmartEditingHandler";

describe("SmartEditingHandler", () => {
	it("indents once between matching braces on enter", () => {
		const handler = new SmartEditingHandler();

		const result = handler.handleEnter("{}", 1);

		expect(result.handled).toBe(true);
		expect(result.newText).toBe("{\n  \n}");
		expect(result.newCursorOffset).toBe(4);
	});

	it("auto-completes opening braces without duplicating the typed character", () => {
		const handler = new SmartEditingHandler();

		const result = handler.handleCharacterInsert("{", "", 0);

		expect(result.handled).toBe(true);
		expect(result.newText).toBe("{}");
		expect(result.newCursorOffset).toBe(1);
	});

	it("skips over an existing closing brace instead of inserting another one", () => {
		const handler = new SmartEditingHandler();

		const result = handler.handleCharacterInsert("}", "{}", 1);

		expect(result.handled).toBe(true);
		expect(result.newText).toBe("{}");
		expect(result.newCursorOffset).toBe(2);
	});
});
