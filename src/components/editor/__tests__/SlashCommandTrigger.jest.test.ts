import { findSlashCommandTriggerStart } from "@/components/editor/slash-commands/SlashCommandTrigger";

describe("findSlashCommandTriggerStart", () => {
	it("detects a slash command at the beginning of a block", () => {
		expect(findSlashCommandTriggerStart("/temp", 5)).toBe(0);
	});

	it("detects a slash command after whitespace", () => {
		expect(findSlashCommandTriggerStart("Hello /temp", 11)).toBe(6);
	});

	it("ignores slashes in urls", () => {
		expect(findSlashCommandTriggerStart("https://example.com", 19)).toBeNull();
	});

	it("ignores slashes inside words or dates", () => {
		expect(findSlashCommandTriggerStart("3/29", 4)).toBeNull();
		expect(findSlashCommandTriggerStart("word/test", 9)).toBeNull();
	});

	it("stops treating it as a slash command after whitespace in the query", () => {
		expect(findSlashCommandTriggerStart("/insert template", 16)).toBeNull();
	});
});
