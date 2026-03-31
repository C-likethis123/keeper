import {
	getNoteIdFromMarkdownPath,
	isIndexedNoteMarkdownPath,
	isTemplateMarkdownPath,
} from "../templatePaths";

describe("templatePaths", () => {
	it("treats template markdown paths as indexable", () => {
		expect(isIndexedNoteMarkdownPath("templates/template-1.md")).toBe(true);
		expect(isTemplateMarkdownPath("templates/template-1.md")).toBe(true);
	});

	it("extracts note ids from template and regular markdown paths", () => {
		expect(getNoteIdFromMarkdownPath("templates/template-1.md")).toBe(
			"template-1",
		);
		expect(getNoteIdFromMarkdownPath("note-1.md")).toBe("note-1");
	});
});
