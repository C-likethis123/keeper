import { File } from "expo-file-system";
import { NOTES_ROOT } from "../Notes";
import { parseFrontmatter } from "../frontmatter";
import type {
	NoteIndexItem,
	NoteIndexRow,
	NoteIndexSqlItem,
} from "./types";

export function extractSummary(markdown: string, maxLines = 6): string {
	const lines: string[] = [];
	let start = 0;

	for (let i = 0; i <= markdown.length; i += 1) {
		const atEnd = i === markdown.length;
		if (!atEnd && markdown[i] !== "\n") {
			continue;
		}

		let line = markdown.slice(start, i);
		if (line.endsWith("\r")) {
			line = line.slice(0, -1);
		}
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			lines.push(trimmed);
			if (lines.length >= maxLines) {
				break;
			}
		}
		start = i + 1;
	}

	return lines.join("\n");
}

export function mapDbRowToIndexItem(row: NoteIndexRow): NoteIndexItem {
	return {
		noteId: row.id,
		title: row.title,
		summary: row.summary,
		isPinned: row.is_pinned !== 0,
		updatedAt: row.updated_at,
		noteType: row.note_type ?? "note",
		status: row.status ?? undefined,
	};
}

export function mapIndexItemToSqlItem(item: NoteIndexItem): NoteIndexSqlItem {
	return {
		id: item.noteId,
		title: item.title ?? "",
		summary: item.summary,
		isPinned: item.isPinned ? 1 : 0,
		updatedAt: item.updatedAt,
		noteType: item.noteType,
		status: item.noteType === "todo" ? (item.status ?? "open") : null,
	};
}

export async function mapMarkdownPathToSqlItem(
	path: string,
): Promise<NoteIndexSqlItem | null> {
	const file = new File(NOTES_ROOT, path);
	if (!file.exists) {
		return null;
	}
	const parsed = parseFrontmatter(await file.text());
	return {
		id: parsed.id,
		title: parsed.title,
		summary: extractSummary(parsed.content),
		isPinned: parsed.isPinned ? 1 : 0,
		updatedAt: file.modificationTime ?? 0,
		noteType: parsed.noteType ?? null,
		status: parsed.noteType === "todo" ? (parsed.status ?? "open") : null,
	};
}

export async function mapMarkdownFileToSqlItem(
	entry: File,
): Promise<NoteIndexSqlItem> {
	const parsed = parseFrontmatter(await entry.text());
	return {
		id: parsed.id,
		title: parsed.title,
		summary: extractSummary(parsed.content),
		isPinned: parsed.isPinned ? 1 : 0,
		updatedAt: entry.modificationTime ?? 0,
		noteType: parsed.noteType ?? null,
		status: parsed.noteType === "todo" ? (parsed.status ?? "open") : null,
	};
}
