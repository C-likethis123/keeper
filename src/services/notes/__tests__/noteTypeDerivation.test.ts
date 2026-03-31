import { deriveNoteType } from "../noteTypeDerivation";

describe("deriveNoteType", () => {
	describe("journal", () => {
		it("matches exact 'Journal' prefix", () => {
			expect(deriveNoteType("Journal 2024-01-15")).toBe("journal");
		});
		it("matches lowercase 'journal'", () => {
			expect(deriveNoteType("journal entry")).toBe("journal");
		});
		it("matches 'JOURNAL' uppercase", () => {
			expect(deriveNoteType("JOURNAL March")).toBe("journal");
		});
		it("does not match 'journal' in the middle of title", () => {
			expect(deriveNoteType("My journal")).toBe("note");
		});
	});

	describe("todo", () => {
		it("matches 'Todo' prefix", () => {
			expect(deriveNoteType("Todo: Buy groceries")).toBe("todo");
		});
		it("matches 'TODO' uppercase prefix", () => {
			expect(deriveNoteType("TODO list")).toBe("todo");
		});
		it("matches 'To-do' prefix", () => {
			expect(deriveNoteType("To-do: Feature planning")).toBe("todo");
		});
		it("derives todo from checklist content when the title is generic", () => {
			expect(deriveNoteType("Weekend prep", "- [ ] Buy groceries")).toBe("todo");
		});
	});

	describe("template", () => {
		it("matches 'Template' prefix", () => {
			expect(deriveNoteType("Template: Weekly Review")).toBe("template");
		});
		it("matches lowercase 'template'", () => {
			expect(deriveNoteType("template weekly")).toBe("template");
		});
	});

	describe("resource", () => {
		it("matches 'Resource:' prefix", () => {
			expect(deriveNoteType("Resource: Atomic Habits")).toBe("resource");
		});
		it("matches 'Book:' prefix", () => {
			expect(deriveNoteType("Book: Atomic Habits")).toBe("resource");
		});
		it("matches 'Article:' prefix", () => {
			expect(deriveNoteType("Article: React Patterns")).toBe("resource");
		});
		it("matches 'Reddit:' prefix", () => {
			expect(deriveNoteType("Reddit: best practices compilation")).toBe(
				"resource",
			);
		});
		it("matches 'Video:' prefix", () => {
			expect(deriveNoteType("Video: TypeScript deep dive")).toBe("resource");
		});
		it("matches 'Podcast:' prefix", () => {
			expect(deriveNoteType("Podcast: Lex Fridman")).toBe("resource");
		});
		it("matches 'Link:' prefix", () => {
			expect(deriveNoteType("Link: awesome repo")).toBe("resource");
		});
		it("matches 'Ref:' prefix", () => {
			expect(deriveNoteType("Ref: MDN documentation")).toBe("resource");
		});
		it("matches 'Paper:' prefix", () => {
			expect(deriveNoteType("Paper: Attention Is All You Need")).toBe(
				"resource",
			);
		});
		it("matches 'Source:' prefix", () => {
			expect(deriveNoteType("Source: internal wiki")).toBe("resource");
		});
		it("matches https URL in title", () => {
			expect(deriveNoteType("https://reddit.com/r/programming")).toBe(
				"resource",
			);
		});
		it("matches http URL in title", () => {
			expect(deriveNoteType("http://example.com/article")).toBe("resource");
		});
		it("matches URL anywhere in title", () => {
			expect(deriveNoteType("Notes on https://example.com")).toBe("resource");
		});
		it("is case-insensitive for 'resource' prefix", () => {
			expect(deriveNoteType("RESOURCE: something")).toBe("resource");
		});
		it("derives resource from url-rich content when the title is generic", () => {
			expect(
				deriveNoteType("Research notes", "Useful link: https://example.com"),
			).toBe("resource");
		});
	});

	describe("journal by content", () => {
		it("derives journal from a dated journal-style body", () => {
			expect(
				deriveNoteType(
					"Daily capture",
					"2026-04-01\nToday I felt more focused after a short walk.",
				),
			).toBe("journal");
		});
	});

	describe("note (default)", () => {
		it("returns note for empty string", () => {
			expect(deriveNoteType("")).toBe("note");
		});
		it("returns note for generic title", () => {
			expect(deriveNoteType("My thoughts on React")).toBe("note");
		});
		it("returns note for title with no matching prefix", () => {
			expect(deriveNoteType("Meeting notes 2024")).toBe("note");
		});
	});
});
