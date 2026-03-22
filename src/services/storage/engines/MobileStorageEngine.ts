import { getTemplatesRoot, NOTES_ROOT } from "@/services/notes/Notes";
import {
	parseFrontmatter,
	stringifyFrontmatter,
} from "@/services/notes/frontmatter";
import { resetNotesIndexDb } from "@/services/notes/indexDb/db";
import { extractSummary } from "@/services/notes/indexDb/mapper";
import { rebuildFromDisk } from "@/services/notes/indexDb/rebuildService";
import {
	type NotesIndexRebuildMetrics,
	notesIndexDbDelete,
	notesIndexDbHasRows,
	notesIndexDbListAll,
	notesIndexDbUpsert,
} from "@/services/notes/notesIndexDb";
import {
	parseTemplateFrontmatter,
	stringifyTemplateFrontmatter,
} from "@/services/notes/templateFrontmatter";
import type { Note, NoteListFilters, NoteTemplate } from "@/services/notes/types";
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
		const templatesDir = new Directory(getTemplatesRoot());
		if (!templatesDir.exists) {
			templatesDir.create({ intermediates: true });
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
			if (!file.exists) return null;
			const parsed = parseFrontmatter(await file.text());
			return {
				id,
				title: parsed.title,
				content: parsed.content,
				lastUpdated: file.modificationTime ?? 0,
				isPinned: parsed.isPinned,
				noteType: parsed.noteType,
				status: parsed.noteType === "todo" ? parsed.status : undefined,
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
			.filter(
				(entry): entry is File =>
					entry instanceof File && entry.name.endsWith(".md"),
			)
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
		filters?: NoteIndexQueryFilters,
	): Promise<NoteIndexListResult> {
		return notesIndexDbListAll(query, limit, offset, filters);
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return rebuildFromDisk();
	}

	async loadTemplate(id: string): Promise<NoteTemplate | null> {
		try {
			const file = new File(getTemplatesRoot(), `${id}.md`);
			if (!file.exists) return null;
			const parsed = parseTemplateFrontmatter(await file.text());
			return {
				id,
				title: parsed.title,
				content: parsed.content,
				lastUpdated: file.modificationTime ?? 0,
				noteType: parsed.noteType,
				status: parsed.noteType === "todo" ? parsed.status : undefined,
			};
		} catch {
			return null;
		}
	}

	async saveTemplate(template: NoteTemplate): Promise<NoteTemplate> {
		const dir = new Directory(getTemplatesRoot());
		if (!dir.exists) {
			dir.create({ intermediates: true });
		}
		const file = new File(getTemplatesRoot(), `${template.id}.md`);
		const content = stringifyTemplateFrontmatter(template);
		await file.write(content);
		const updatedAt = file.modificationTime ?? template.lastUpdated;
		return {
			...template,
			title: (template.title ?? "").trim(),
			lastUpdated: updatedAt,
		};
	}

	async deleteTemplate(id: string): Promise<boolean> {
		const file = new File(getTemplatesRoot(), `${id}.md`);
		if (!file.exists) return false;
		file.delete();
		return true;
	}

	async listTemplates(): Promise<NoteTemplate[]> {
		const dir = new Directory(getTemplatesRoot());
		if (!dir.exists) {
			return [];
		}
		const files = dir
			.list()
			.filter(
				(entry): entry is File =>
					entry instanceof File && entry.name.endsWith(".md"),
			)
			.sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
		const templates = await Promise.all(
			files.map(async (entry) => {
				const parsed = parseTemplateFrontmatter(await entry.text());
				return {
					id: entry.name.replace(/\.md$/, ""),
					title: parsed.title,
					content: parsed.content,
					lastUpdated: entry.modificationTime ?? 0,
					noteType: parsed.noteType,
					status: parsed.noteType === "todo" ? parsed.status : undefined,
				} satisfies NoteTemplate;
			}),
		);
		return templates;
	}

	async listNotesFallback(
		limit: number,
		offset?: number,
		query?: string,
		filters?: NoteListFilters,
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
			const matchesType =
				!filters?.noteType || loaded.noteType === filters.noteType;
			const matchesStatus =
				!filters?.status || loaded.status === filters.status;
			if (!matches || !matchesType || !matchesStatus) continue;
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
