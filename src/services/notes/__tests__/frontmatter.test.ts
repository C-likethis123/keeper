import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter";

describe("frontmatter", () => {
	it("parses quoted YAML scalars and todo metadata", () => {
		const parsed = parseFrontmatter(`---
id: "note-1"
title: "Ship \"v2\""
pinned: true
type: todo
status: doing
createdAt: 1710000000000
completedAt: 1710003600000
---
Body`);

		expect(parsed).toEqual({
			id: "note-1",
			title: 'Ship "v2"',
			isPinned: true,
			noteType: "todo",
			status: "doing",
			createdAt: 1710000000000,
			completedAt: 1710003600000,
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
			createdAt: 1,
			completedAt: 2,
		});

		expect(markdown).toContain("pinned: true");
		expect(markdown).toContain('title: "Roadmap"');
		expect(markdown).toContain('id: "note-123"');
		expect(markdown).toContain('type: "resource"');
		expect(markdown).not.toContain("status:");
		expect(markdown).not.toContain("createdAt:");
		expect(markdown).not.toContain("completedAt:");
		expect(markdown.endsWith("\nBody")).toBe(true);
	});

	it("stringifies todo lifecycle metadata", () => {
		const markdown = stringifyFrontmatter({
			id: "todo-1",
			title: "TODO: Ship release",
			isPinned: false,
			content: "",
			noteType: "todo",
			status: "done",
			createdAt: 1710000000000,
			completedAt: 1710003600000,
		});

		expect(markdown).toContain('status: "done"');
		expect(markdown).toContain("createdAt: 1710000000000");
		expect(markdown).toContain("completedAt: 1710003600000");
	});
});
