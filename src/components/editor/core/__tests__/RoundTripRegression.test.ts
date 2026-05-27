import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "@/services/notes/frontmatter";

import { createDocumentFromMarkdown, documentToMarkdown } from "../Document";

describe("markdown round-trip regressions", () => {
	it("does not drop content when round-tripping a real-world note (f341 version)", () => {
		const fixturePath = path.join(
			__dirname,
			"fixtures",
			"So_aLykzv2lnaihoF2fEK.f341.md",
		);
		const raw = fs.readFileSync(fixturePath, "utf8");
		const { content } = parseFrontmatter(raw);

		const doc = createDocumentFromMarkdown(content);
		const roundTripped = documentToMarkdown(doc);

		// These lines were observed to disappear in commit 0d4325a3 compared to f341ae61.
		expect(roundTripped).toContain("let mut guard = counter.lock().unwrap();");
		expect(roundTripped).toContain("std::hint::black_box(*guard);");
		expect(roundTripped).toMatch(/#\s+Further reading/);
		expect(roundTripped).toContain("The left right crate");
	});

	it("shows the post-restart committed version (0d4325) is missing expected content", () => {
		const fixturePath = path.join(
			__dirname,
			"fixtures",
			"So_aLykzv2lnaihoF2fEK.0d4325.md",
		);
		const raw = fs.readFileSync(fixturePath, "utf8");
		const { content } = parseFrontmatter(raw);

		expect(content).not.toContain("let mut guard = counter.lock().unwrap();");
		expect(content).not.toContain("# Further reading");
	});
});
