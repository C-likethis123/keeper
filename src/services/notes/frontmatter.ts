import type { Note, NoteStatus, NoteType } from "@/services/notes/types";

export interface ParsedFrontmatter {
	id: string;
	title: string;
	isPinned: boolean;
	noteType: NoteType;
	status?: NoteStatus;
	content: string;
}

function isNoteType(value: string): value is NoteType {
	return ["journal", "resource", "todo", "note"].includes(value);
}

function isNoteStatus(value: string): value is NoteStatus {
	return ["open", "blocked", "doing", "done"].includes(value);
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

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
	if (!match) {
		return {
			id: "",
			title: "",
			isPinned: false,
			noteType: "note",
			content: markdown,
		};
	}

	let title = "";
	let isPinned = false;
	let noteType: NoteType = "note";
	let status: NoteStatus | undefined;
	let id = "";
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
		} else if (key === "id") {
			id = value;
		} else if (key === "pinned") {
			isPinned = value.toLowerCase() === "true";
		} else if (key === "type" && isNoteType(value)) {
			noteType = value;
		} else if (key === "status" && isNoteStatus(value)) {
			status = value;
		}
	}

	return {
		id,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? status : undefined,
		content,
	};
}

export function stringifyFrontmatter(note: Omit<Note, "lastUpdated">): string {
	const frontmatterLines = [
		"---",
		`pinned: ${note.isPinned ? "true" : "false"}`,
		`title: ${JSON.stringify((note.title ?? "").trim())}`,
		`id: ${JSON.stringify(note.id)}`,
	];
	if (note.noteType) {
		frontmatterLines.push(`type: ${JSON.stringify(note.noteType)}`);
	}
	if (note.noteType === "todo" && note.status) {
		frontmatterLines.push(`status: ${JSON.stringify(note.status)}`);
	}
	frontmatterLines.push("---");

	return `${frontmatterLines.join("\n")}\n${note.content}`;
}
