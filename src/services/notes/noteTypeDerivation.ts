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

const CHECKBOX_ITEM_PATTERN = /(?:^|\n)\s*-\s\[[ xX]\]\s+\S+/;
const URL_PATTERN = /https?:\/\/\S+/i;
const JOURNAL_DATE_PATTERN =
	/(?:^|\n)\s*(?:#\s*)?(?:\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2}, \d{4})\b/m;
const JOURNAL_REFLECTION_PATTERN =
	/\b(?:today i|today,|dear diary|daily reflection|gratitude|reflecting on)\b/i;

function deriveNoteTypeFromContent(
	content: string,
): Exclude<NoteType, "note"> | null {
	const trimmed = content.trim();

	if (!trimmed) {
		return null;
	}

	if (CHECKBOX_ITEM_PATTERN.test(trimmed)) {
		return "todo";
	}

	if (URL_PATTERN.test(trimmed)) {
		return "resource";
	}

	if (
		JOURNAL_DATE_PATTERN.test(trimmed) ||
		JOURNAL_REFLECTION_PATTERN.test(trimmed)
	) {
		return "journal";
	}

	return null;
}

export function deriveNoteType(title: string, content = ""): NoteType {
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

	const contentType = deriveNoteTypeFromContent(content);
	if (contentType) {
		return contentType;
	}

	return "note";
}
