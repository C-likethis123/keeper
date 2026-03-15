import { parseFrontmatter, stringifyFrontmatter } from "@/services/notes/frontmatter";
import {
	type NotesIndexRebuildMetrics,
	notesIndexDbReset,
	notesIndexDbDelete,
	notesIndexDbHasRows,
	notesIndexDbListAll,
	notesIndexDbRebuildFromDisk,
	notesIndexDbUpsert,
} from "@/services/notes/notesIndexDb";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { Note } from "@/services/notes/types";
import type { NoteFileEntry, StorageEngine, StorageInitializeResult } from "@/services/storage/engines/StorageEngine";
import type { NoteIndexListResult, NoteIndexPersistenceItem } from "@/services/storage/types";
import { Directory, File } from "expo-file-system";

function extractSummary(markdown: string, maxLines = 6): string {
	const lines: string[] = [];
	for (const line of markdown.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		lines.push(trimmed);
		if (lines.length >= maxLines) break;
	}
	return lines.join("\n");
}

function deleteDirectoryRecursive(dir: Directory): void {
	if (!dir.exists) {
		return;
	}

	for (const entry of dir.list()) {
		if (entry instanceof Directory) {
			deleteDirectoryRecursive(entry);
			continue;
		}
		entry.delete();
	}

	dir.delete();
}

export class MobileStorageEngine implements StorageEngine {
	async initialize(): Promise<StorageInitializeResult> {
		const dir = new Directory(NOTES_ROOT);
		if (!dir.exists) {
			dir.create({ intermediates: true });
		}

		const hasRows = await notesIndexDbHasRows();
		const hasMarkdownFiles = dir
			.list()
			.some((entry) => entry instanceof File && entry.name.endsWith(".md"));

		return {
			notesRoot: NOTES_ROOT,
			needsRebuild: hasMarkdownFiles && !hasRows,
		};
	}

	async resetAllData(): Promise<void> {
		const dir = new Directory(NOTES_ROOT);
		if (dir.exists) {
			deleteDirectoryRecursive(dir);
		}

		await notesIndexDbReset();
		dir.create({ intermediates: true, idempotent: true });
		const remainingFiles = dir
			.list()
			.filter((entry): entry is File => entry instanceof File);
		if (remainingFiles.length > 0) {
			throw new Error("Failed to clear note storage");
		}
	}

	async loadNote(id: string): Promise<Note | null> {
		try {
			const file = new File(NOTES_ROOT, `${id}.md`);
			if (!file.exists) return null;
			const parsed = parseFrontmatter(await file.text());
			return {
				id,
				title: parsed.title,
				content: parsed.content,
				lastUpdated: file.modificationTime ?? 0,
				isPinned: parsed.isPinned,
			};
		} catch {
			return null;
		}
	}

	async saveNote(note: Note): Promise<Note> {
		const dir = new Directory(NOTES_ROOT);
		if (!dir.exists) {
			dir.create({ intermediates: true });
		}
		const file = new File(NOTES_ROOT, `${note.id}.md`);
		const content = stringifyFrontmatter(note);
		await file.write(content);
		const updatedAt = file.modificationTime ?? note.lastUpdated;
		return {
			...note,
			title: (note.title ?? "").trim(),
			lastUpdated: updatedAt,
		};
	}

	async deleteNote(id: string): Promise<boolean> {
		const file = new File(NOTES_ROOT, `${id}.md`);
		if (!file.exists) return false;
		file.delete();
		return true;
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		const dir = new Directory(NOTES_ROOT);
		if (!dir.exists) {
			return [];
		}
		const items = dir
			.list()
			.filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".md"))
			.map((entry) => ({
				id: entry.name.replace(/\.md$/, ""),
				updatedAt: entry.modificationTime ?? 0,
			}));
		items.sort((a, b) => b.updatedAt - a.updatedAt);
		return items;
	}

	async statNote(id: string): Promise<number | null> {
		const file = new File(NOTES_ROOT, `${id}.md`);
		if (!file.exists) {
			return null;
		}
		return file.modificationTime ?? 0;
	}

	async indexUpsert(item: NoteIndexPersistenceItem): Promise<void> {
		await notesIndexDbUpsert(item);
	}

	async indexDelete(noteId: string): Promise<void> {
		await notesIndexDbDelete(noteId);
	}

	async indexList(
		query: string,
		limit: number,
		offset?: number,
	): Promise<NoteIndexListResult> {
		return notesIndexDbListAll(query, limit, offset);
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return notesIndexDbRebuildFromDisk();
	}

	async listNotesFallback(
		limit: number,
		offset?: number,
		query?: string,
	): Promise<Note[]> {
		const normalizedQuery = query?.trim().toLowerCase() ?? "";
		const files = await this.listNoteFiles();
		const filtered: Note[] = [];
		for (const file of files) {
			const loaded = await this.loadNote(file.id);
			if (!loaded) continue;
			const matches =
				normalizedQuery.length === 0 ||
				loaded.title.toLowerCase().includes(normalizedQuery) ||
				loaded.content.toLowerCase().includes(normalizedQuery);
			if (!matches) continue;
			filtered.push({
				...loaded,
				content: extractSummary(loaded.content),
			});
		}
		filtered.sort((a, b) => {
			if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
			return b.lastUpdated - a.lastUpdated;
		});
		const from = Math.max(0, offset ?? 0);
		return filtered.slice(from, from + limit);
	}
}
