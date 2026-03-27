import type { NoteType } from "./types";

const RESOURCE_PREFIXES = [
	"resource",
	"book:",
	"article:",
	"paper:",
	"reddit:",
	"video:",
	"podcast:",
	"link:",
	"ref:",
	"source:",
];

export function deriveNoteType(title: string): NoteType {
	const lower = title.trimStart().toLowerCase();

	if (lower.startsWith("journal")) return "journal";
	if (lower.startsWith("todo") || lower.startsWith("to-do")) return "todo";
	if (lower.startsWith("template")) return "template";

	if (
		RESOURCE_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
		/https?:\/\//.test(title)
	) {
		return "resource";
	}

	return "note";
}
