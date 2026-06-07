import { handleCodeTextInsertion } from "../plugins/codeBlockSmartEdit";

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
});
