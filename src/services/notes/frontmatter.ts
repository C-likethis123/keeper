import type { Note, NoteStatus, NoteType } from "@/services/notes/types";

interface ParsedFrontmatter {
	id: string;
	title: string;
	isPinned: boolean;
	noteType: NoteType;
	status?: NoteStatus;
	createdAt?: number;
	completedAt?: number;
	modified?: number;
	attachment?: string;
	attachedVideo?: string;
	resourceUrl?: string;
	documentPositions?: Record<string, string>;
	content: string;
}

function isNoteType(value: string): value is NoteType {
	return ["journal", "resource", "todo", "note", "template"].includes(value);
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

function parseTimestamp(value: string): number | undefined {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}
	return parsed;
}

function parseDocumentPositions(value: string): Record<string, string> | undefined {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}
		const positions: Record<string, string> = {};
		for (const [key, position] of Object.entries(parsed)) {
			if (typeof key === "string" && typeof position === "string") {
				positions[key] = position;
			}
		}
		return Object.keys(positions).length > 0 ? positions : undefined;
	} catch {
		return undefined;
	}
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
	let createdAt: number | undefined;
	let completedAt: number | undefined;
	let modified: number | undefined;
	let attachment: string | undefined;
	let attachedVideo: string | undefined;
	let resourceUrl: string | undefined;
	let documentPositions: Record<string, string> | undefined;
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
		} else if (key === "createdAt") {
			createdAt = parseTimestamp(value);
		} else if (key === "completedAt") {
			completedAt = parseTimestamp(value);
		} else if (key === "modified") {
			modified = parseTimestamp(value);
		} else if (key === "attachment") {
			attachment = value;
		} else if (key === "attachedVideo") {
			attachedVideo = value;
		} else if (key === "resourceUrl") {
			resourceUrl = value;
		} else if (key === "documentPositions") {
			documentPositions = parseDocumentPositions(value);
		}
	}

	return {
		id,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? status : undefined,
		createdAt: noteType === "todo" ? createdAt : undefined,
		completedAt: noteType === "todo" ? completedAt : undefined,
		modified,
		attachment,
		attachedVideo,
		resourceUrl,
		documentPositions,
		content,
	};
}

export function stringifyFrontmatter(
	note: Omit<Note, "lastUpdated"> & {
		modified?: number;
		attachment?: string | null;
		resourceUrl?: string | null;
		documentPositions?: Record<string, string> | null;
	},
): string {
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
	if (note.noteType === "todo" && note.createdAt) {
		frontmatterLines.push(`createdAt: ${note.createdAt}`);
	}
	if (note.noteType === "todo" && note.completedAt) {
		frontmatterLines.push(`completedAt: ${note.completedAt}`);
	}
	if (note.modified) {
		frontmatterLines.push(`modified: ${note.modified}`);
	}
	if (note.attachment) {
		frontmatterLines.push(`attachment: ${JSON.stringify(note.attachment)}`);
	}
	if (note.attachedVideo) {
		frontmatterLines.push(
			`attachedVideo: ${JSON.stringify(note.attachedVideo)}`,
		);
	}
	if (note.resourceUrl) {
		frontmatterLines.push(`resourceUrl: ${JSON.stringify(note.resourceUrl)}`);
	}
	if (note.documentPositions && Object.keys(note.documentPositions).length > 0) {
		frontmatterLines.push(
			`documentPositions: ${JSON.stringify(note.documentPositions)}`,
		);
	}
	frontmatterLines.push("---");

	return `${frontmatterLines.join("\n")}\n${note.content}`;
}
