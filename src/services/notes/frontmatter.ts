import type { Note } from "@/services/notes/types";

export interface ParsedFrontmatter {
	title: string;
	isPinned: boolean;
	content: string;
}

function parseYamlScalar(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed) as string;
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
		return trimmed.slice(1, -1).replace(/''/g, "'");
	}
	return trimmed;
}

function stringifyYamlString(value: string): string {
	return JSON.stringify(value);
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
	if (!match) {
		return {
			title: "",
			isPinned: false,
			content: markdown,
		};
	}

	let title = "";
	let isPinned = false;
	const frontmatter = match[1];
	const content = markdown.slice(match[0].length);

	for (const rawLine of frontmatter.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const separator = line.indexOf(":");
		if (separator < 0) continue;

		const key = line.slice(0, separator).trim();
		const value = parseYamlScalar(line.slice(separator + 1));
		if (key === "title") {
			title = value;
		} else if (key === "pinned") {
			isPinned = value.toLowerCase() === "true";
		}
	}

	return {
		title,
		isPinned,
		content,
	};
}

export function stringifyFrontmatter(note: Pick<Note, "id" | "title" | "isPinned" | "content">): string {
	const frontmatterLines = [
		"---",
		`pinned: ${note.isPinned ? "true" : "false"}`,
		`title: ${stringifyYamlString((note.title ?? "").trim())}`,
		`id: ${stringifyYamlString(note.id)}`,
		"---",
	];

	return `${frontmatterLines.join("\n")}\n${note.content}`;
}
