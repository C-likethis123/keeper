import { NOTES_ROOT, getTemplatesRoot } from "@/services/notes/Notes";
import {
	parseFrontmatter,
	stringifyFrontmatter,
} from "@/services/notes/frontmatter";
import { resetNotesIndexDb } from "@/services/notes/indexDb/db";
import { rebuildFromDisk } from "@/services/notes/indexDb/rebuildService";
import {
	type NotesIndexRebuildMetrics,
	notesIndexDbDelete,
	notesIndexDbHasRows,
	notesIndexDbListAll,
	notesIndexDbUpsert,
} from "@/services/notes/notesIndexDb";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import type {
	NoteFileEntry,
	StorageEngine,
	StorageInitializeResult,
} from "@/services/storage/engines/StorageEngine";
import type {
	NoteIndexListResult,
	NoteIndexPersistenceItem,
	NoteIndexQueryFilters,
} from "@/services/storage/types";
import { Directory, File } from "expo-file-system";

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

		await resetNotesIndexDb();
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
			if (file.exists) {
				const parsed = parseFrontmatter(await file.text());
				return {
					id,
					title: parsed.title,
					content: parsed.content,
					lastUpdated: file.modificationTime ?? 0,
					isPinned: parsed.isPinned,
					noteType: parsed.noteType,
					status: parsed.noteType === "todo" ? (parsed.status ?? null) : null,
					createdAt:
						parsed.noteType === "todo" ? (parsed.createdAt ?? null) : null,
					completedAt:
						parsed.noteType === "todo" ? (parsed.completedAt ?? null) : null,
				};
			}
			const templateFile = new File(getTemplatesRoot(), `${id}.md`);
			if (templateFile.exists) {
				const parsed = parseFrontmatter(await templateFile.text());
				return {
					id,
					title: parsed.title,
					content: parsed.content,
					lastUpdated: templateFile.modificationTime ?? 0,
					isPinned: false,
					noteType: parsed.noteType,
					status: parsed.noteType === "todo" ? (parsed.status ?? null) : null,
					createdAt:
						parsed.noteType === "todo" ? (parsed.createdAt ?? null) : null,
					completedAt:
						parsed.noteType === "todo" ? (parsed.completedAt ?? null) : null,
				};
			}
			return null;
		} catch {
			return null;
		}
	}

	async saveNote(note: NoteSaveInput): Promise<Note> {
		const isTemplate = note.noteType === "template";
		const root = isTemplate ? getTemplatesRoot() : NOTES_ROOT;
		const dir = new Directory(root);
		if (!dir.exists) {
			dir.create({ intermediates: true });
		}
		const file = new File(root, `${note.id}.md`);
		const content = stringifyFrontmatter(note);
		await file.write(content);
		const updatedAt = file.modificationTime ?? Date.now();
		return {
			...note,
			title: (note.title ?? "").trim(),
			lastUpdated: updatedAt,
		};
	}

	async deleteNote(id: string): Promise<boolean> {
		const file = new File(NOTES_ROOT, `${id}.md`);
		if (file.exists) {
			file.delete();
			return true;
		}
		const templateFile = new File(getTemplatesRoot(), `${id}.md`);
		if (templateFile.exists) {
			templateFile.delete();
			return true;
		}
		return false;
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		const items: NoteFileEntry[] = [];

		const notesDir = new Directory(NOTES_ROOT);
		if (notesDir.exists) {
			for (const entry of notesDir.list()) {
				if (entry instanceof File && entry.name.endsWith(".md")) {
					items.push({
						id: entry.name.replace(/\.md$/, ""),
						updatedAt: entry.modificationTime ?? 0,
					});
				}
			}
		}

		const templatesDir = new Directory(getTemplatesRoot());
		if (templatesDir.exists) {
			for (const entry of templatesDir.list()) {
				if (entry instanceof File && entry.name.endsWith(".md")) {
					items.push({
						id: entry.name.replace(/\.md$/, ""),
						updatedAt: entry.modificationTime ?? 0,
					});
				}
			}
		}

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
		filters?: NoteIndexQueryFilters,
	): Promise<NoteIndexListResult> {
		return notesIndexDbListAll(query, limit, offset, filters);
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return rebuildFromDisk();
	}
}
