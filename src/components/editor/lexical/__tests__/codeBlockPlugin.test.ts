import {
	handleCodeTextInsertion,
	handleEnter,
} from "../plugins/codeBlockSmartEdit";

describe("LexicalCodeBlockPlugin", () => {
	it("completes opening braces in code blocks", () => {
		expect(handleCodeTextInsertion("foo", 3, "{")).toEqual({
			handled: true,
			newCursorOffset: 4,
			newText: "foo{}",
		});
	});

	it("steps over an existing closing brace", () => {
		expect(handleCodeTextInsertion("foo{}", 4, "}")).toEqual({
			handled: true,
			newCursorOffset: 5,
			newText: "foo{}",
		});
	});

	it("ignores ordinary text insertion", () => {
		expect(handleCodeTextInsertion("foo", 3, "a")).toEqual({
			handled: false,
			newCursorOffset: 3,
			newText: "foo",
		});
	});

	it("opens an indented blank line between paired braces", () => {
		expect(handleEnter("if (ok) {}", 9)).toEqual({
			handled: true,
			newCursorOffset: 14,
			newText: "if (ok) {\n    \n}",
		});
	});

	it("keeps closing brace aligned with the current block indent", () => {
		expect(handleEnter("    if (ok) {}", 13)).toEqual({
			handled: true,
			newCursorOffset: 22,
			newText: "    if (ok) {\n        \n    }",
		});
	});
});
