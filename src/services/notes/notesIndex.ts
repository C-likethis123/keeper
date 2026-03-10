import type { ListNotesResult } from "./notesIndexDb";
import { getStorageEngine } from "@/services/storage/storageEngine";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
}

export type { ListNotesResult };

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await getStorageEngine().indexUpsert(item);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await getStorageEngine().indexDelete(noteId);
	}

	static async listNotes(
		query: string,
		limit = 20,
		offset?: number,
	): Promise<ListNotesResult> {
		return getStorageEngine().indexList(query, limit, offset);
	}

	static async rebuildFromDisk(): Promise<{ noteCount: number }> {
		return getStorageEngine().indexRebuildFromDisk();
	}
}

export function extractSummary(markdown: string, maxLines = 6): string {
	const lines: string[] = [];
	let start = 0;

	for (let i = 0; i <= markdown.length; i += 1) {
		const atEnd = i === markdown.length;
		if (!atEnd && markdown[i] !== "\n") continue;

		let line = markdown.slice(start, i);
		if (line.endsWith("\r")) {
			line = line.slice(0, -1);
		}
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			lines.push(trimmed);
			if (lines.length >= maxLines) break;
		}
		start = i + 1;
	}

	return lines.join("\n");
}
