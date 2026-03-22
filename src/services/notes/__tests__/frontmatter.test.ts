import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter";

describe("frontmatter", () => {
	it("parses quoted YAML scalars and todo metadata", () => {
		const parsed = parseFrontmatter(`---
id: "note-1"
title: "Ship \"v2\""
pinned: true
type: todo
status: doing
---
Body`);

		expect(parsed).toEqual({
			id: "note-1",
			title: 'Ship "v2"',
			isPinned: true,
			noteType: "todo",
			status: "doing",
			content: "Body",
		});
	});

	it("drops status for non-todo notes", () => {
		const parsed = parseFrontmatter(`---
id: "note-2"
title: "Reference"
pinned: false
type: resource
status: done
---
Content`);

		expect(parsed.noteType).toBe("resource");
		expect(parsed.status).toBeUndefined();
	});

	it("falls back to plain content when no frontmatter exists", () => {
		expect(parseFrontmatter("Just text")).toEqual({
			id: "",
			title: "",
			isPinned: false,
			noteType: "note",
			content: "Just text",
		});
	});

	it("stringifies supported metadata fields and omits todo status for other note types", () => {
		const markdown = stringifyFrontmatter({
			id: "note-123",
			title: " Roadmap ",
			isPinned: true,
			content: "Body",
			noteType: "resource",
			status: "done",
		});

		expect(markdown).toContain("pinned: true");
		expect(markdown).toContain('title: "Roadmap"');
		expect(markdown).toContain('id: "note-123"');
		expect(markdown).toContain('type: "resource"');
		expect(markdown).not.toContain("status:");
		expect(markdown.endsWith("\nBody")).toBe(true);
	});
});
