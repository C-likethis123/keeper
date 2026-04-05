import {
	getNoteIdFromMarkdownPath,
	isIndexedNoteMarkdownPath,
} from "../templatePaths";

describe("templatePaths", () => {
	it("treats markdown paths as indexable", () => {
		expect(isIndexedNoteMarkdownPath("template-1.md")).toBe(true);
		expect(isIndexedNoteMarkdownPath("notes/template-1.md")).toBe(true);
	});

	it("extracts note ids from markdown paths", () => {
		expect(getNoteIdFromMarkdownPath("template-1.md")).toBe("template-1");
		expect(getNoteIdFromMarkdownPath("note-1.md")).toBe("note-1");
	});
});
