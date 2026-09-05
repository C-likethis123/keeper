import { parseFrontmatter, stringifyFrontmatter } from "@/services/notes/frontmatter";
import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import type {
	NoteFileEntry,
	NoteIndexListResult,
	NoteIndexPersistenceItem,
	NoteIndexQueryFilters,
	StorageEngine,
	StorageInitializeResult,
} from "@/services/storage/types";

interface StoredFile {
	data: Uint8Array;
	updatedAt: number;
}

function assertSafeRelativePath(path: string): string {
	const parts = path.split("/").filter(Boolean);
	if (
		path.startsWith("/") ||
		parts.length === 0 ||
		parts.some((part) => part === "." || part === "..")
	) {
		throw new Error("Path escapes notes root");
	}
	return parts.join("/");
}

export class MemoryStorageEngine implements StorageEngine {
	private readonly files = new Map<string, StoredFile>();
	private readonly index = new Map<string, NoteIndexPersistenceItem>();

	async initialize(): Promise<StorageInitializeResult> {
		return { notesRoot: "memory://keeper-browser-storage", needsRebuild: false };
	}

	async resetAllData(): Promise<void> {
		this.files.clear();
		this.index.clear();
	}

	async readFileBytes(relativePath: string): Promise<Uint8Array | null> {
		const file = this.files.get(assertSafeRelativePath(relativePath));
		return file ? file.data.slice() : null;
	}

	async writeFileBytes(relativePath: string, data: Uint8Array): Promise<void> {
		this.files.set(assertSafeRelativePath(relativePath), {
			data: data.slice(),
			updatedAt: Date.now(),
		});
	}

	async deleteFile(relativePath: string): Promise<boolean> {
		return this.files.delete(assertSafeRelativePath(relativePath));
	}

	async listFilesRecursive(relativeDir: string): Promise<string[]> {
		const directory = assertSafeRelativePath(relativeDir);
		return [...this.files.keys()].filter((path) => path.startsWith(`${directory}/`));
	}

	async deleteDirectory(relativeDir: string): Promise<void> {
		for (const path of await this.listFilesRecursive(relativeDir)) {
			this.files.delete(path);
		}
	}

	async loadNote(id: string): Promise<Note | null> {
		try {
			const file = this.files.get(`${id}.md`);
			if (!file) return null;
			const parsed = parseFrontmatter(new TextDecoder().decode(file.data));
			const modified = parsed.modified ?? file.updatedAt;
			return {
				id,
				title: parsed.title,
				content: parsed.content,
				lastUpdated: modified,
				isPinned: parsed.isPinned,
				noteType: parsed.noteType,
				status: parsed.noteType === "todo" ? (parsed.status ?? null) : null,
				createdAt: parsed.noteType === "todo" ? (parsed.createdAt ?? null) : null,
				completedAt: parsed.noteType === "todo" ? (parsed.completedAt ?? null) : null,
				attachment: parsed.attachment ?? null,
				attachedVideo: parsed.attachedVideo ?? null,
				resourceUrl: parsed.resourceUrl ?? null,
				documentPositions: parsed.documentPositions ?? null,
				modified,
			};
		} catch {
			return null;
		}
	}

	async saveNote(note: NoteSaveInput): Promise<Note> {
		const modified = Date.now();
		await this.writeFileBytes(
			`${note.id}.md`,
			new TextEncoder().encode(stringifyFrontmatter({ ...note, modified })),
		);
		return { ...note, title: (note.title ?? "").trim(), lastUpdated: modified, modified };
	}

	async deleteNote(id: string): Promise<boolean> {
		return this.files.delete(`${id}.md`);
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		return [...this.files.entries()]
			.filter(([path]) => /^[^/]+\.md$/.test(path))
			.map(([path, file]) => ({ id: path.replace(/\.md$/, ""), updatedAt: file.updatedAt }))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	async statNote(id: string): Promise<number | null> {
		return this.files.get(`${id}.md`)?.updatedAt ?? null;
	}

	async indexUpsert(item: NoteIndexPersistenceItem): Promise<void> {
		this.index.set(item.noteId, { ...item });
	}

	async indexDelete(noteId: string): Promise<void> {
		this.index.delete(noteId);
	}

	async indexList(
		query: string,
		limit: number,
		offset = 0,
		filters?: NoteIndexQueryFilters,
	): Promise<NoteIndexListResult> {
		const term = query.trim().toLocaleLowerCase();
		const filtered = [...this.index.values()]
			.filter((item) => {
				if (term && !`${item.title} ${item.summary}`.toLocaleLowerCase().includes(term)) return false;
				if (filters?.noteTypes?.length && !filters.noteTypes.includes(item.noteType)) return false;
				if (filters?.status && item.status !== filters.status) return false;
				return !(filters?.hideDone && item.status === "done");
			})
			.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt);
		const items = filtered.slice(offset, offset + limit);
		return { items, cursor: offset + items.length < filtered.length ? offset + items.length : undefined };
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		const startedAt = Date.now();
		this.index.clear();
		for (const file of await this.listNoteFiles()) {
			const note = await this.loadNote(file.id);
			if (!note) continue;
			this.index.set(note.id, {
				noteId: note.id,
				title: note.title,
				summary: note.content,
				isPinned: note.isPinned,
				updatedAt: note.lastUpdated,
				noteType: note.noteType,
				status: note.status,
			});
		}
		return { noteCount: this.index.size, totalMs: Date.now() - startedAt };
	}
}
