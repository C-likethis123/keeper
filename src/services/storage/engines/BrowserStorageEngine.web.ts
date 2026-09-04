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

const DATABASE_NAME = "keeper-pwa-storage";
const DATABASE_VERSION = 1;
const FILE_STORE = "files";
const INDEX_STORE = "note-index";

interface StoredFile {
	path: string;
	data: ArrayBuffer;
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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
		transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
	});
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export class BrowserStorageEngine implements StorageEngine {
	private databasePromise: Promise<IDBDatabase> | null = null;

	private getDatabase(): Promise<IDBDatabase> {
		if (!this.databasePromise) {
			const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
				let request: IDBOpenDBRequest;
				try {
					request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
				} catch (error) {
					reject(
						error instanceof Error
							? error
							: new Error("Browser storage is unavailable"),
					);
					return;
				}
				request.onupgradeneeded = () => {
					const database = request.result;
					if (!database) {
						reject(new Error("Browser storage did not return a database"));
						return;
					}
					if (!database.objectStoreNames.contains(FILE_STORE)) {
						database.createObjectStore(FILE_STORE, { keyPath: "path" });
					}
					if (!database.objectStoreNames.contains(INDEX_STORE)) {
						database.createObjectStore(INDEX_STORE, { keyPath: "noteId" });
					}
				};
				request.onsuccess = () => {
					const database = request.result;
					if (!database) {
						reject(new Error("Browser storage did not return a database"));
						return;
					}
					database.onversionchange = () => {
						database.close();
						this.databasePromise = null;
					};
					resolve(database);
				};
				request.onerror = () => reject(request.error ?? new Error("Unable to open browser storage"));
				request.onblocked = () =>
					reject(new Error("Browser storage is blocked by another open tab"));
			});
			this.databasePromise = openPromise;
			void openPromise.catch(() => {
				if (this.databasePromise === openPromise) {
					this.databasePromise = null;
				}
			});
		}
		return this.databasePromise;
	}

	private async getFile(path: string): Promise<StoredFile | undefined> {
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readonly");
		return requestResult(transaction.objectStore(FILE_STORE).get(path));
	}

	async initialize(): Promise<StorageInitializeResult> {
		const database = await this.getDatabase();
		const transaction = database.transaction([FILE_STORE, INDEX_STORE], "readonly");
		const files = await requestResult(transaction.objectStore(FILE_STORE).getAllKeys());
		const indexEntries = await requestResult(transaction.objectStore(INDEX_STORE).count());
		return {
			notesRoot: "indexeddb://keeper-pwa-storage",
			needsRebuild: files.some((path) => typeof path === "string" && path.endsWith(".md")) && indexEntries === 0,
		};
	}

	async resetAllData(): Promise<void> {
		const database = await this.getDatabase();
		const transaction = database.transaction([FILE_STORE, INDEX_STORE], "readwrite");
		transaction.objectStore(FILE_STORE).clear();
		transaction.objectStore(INDEX_STORE).clear();
		await transactionComplete(transaction);
	}

	async readFileBytes(relativePath: string): Promise<Uint8Array | null> {
		const file = await this.getFile(assertSafeRelativePath(relativePath));
		return file ? new Uint8Array(file.data) : null;
	}

	async writeFileBytes(relativePath: string, data: Uint8Array): Promise<void> {
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readwrite");
		transaction.objectStore(FILE_STORE).put({
			path: assertSafeRelativePath(relativePath),
			data: asArrayBuffer(data),
			updatedAt: Date.now(),
		} satisfies StoredFile);
		await transactionComplete(transaction);
	}

	async deleteFile(relativePath: string): Promise<boolean> {
		const path = assertSafeRelativePath(relativePath);
		if (!(await this.getFile(path))) return false;
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readwrite");
		transaction.objectStore(FILE_STORE).delete(path);
		await transactionComplete(transaction);
		return true;
	}

	async listFilesRecursive(relativeDir: string): Promise<string[]> {
		const directory = assertSafeRelativePath(relativeDir);
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readonly");
		const paths = await requestResult(transaction.objectStore(FILE_STORE).getAllKeys());
		return paths.filter((path): path is string => typeof path === "string" && path.startsWith(`${directory}/`));
	}

	async deleteDirectory(relativeDir: string): Promise<void> {
		const paths = await this.listFilesRecursive(relativeDir);
		if (paths.length === 0) return;
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readwrite");
		const store = transaction.objectStore(FILE_STORE);
		for (const path of paths) store.delete(path);
		await transactionComplete(transaction);
	}

	async loadNote(id: string): Promise<Note | null> {
		try {
			const file = await this.getFile(`${id}.md`);
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
		const path = `${id}.md`;
		if (!(await this.getFile(path))) return false;
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readwrite");
		transaction.objectStore(FILE_STORE).delete(path);
		await transactionComplete(transaction);
		return true;
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		const database = await this.getDatabase();
		const transaction = database.transaction(FILE_STORE, "readonly");
		const files = await requestResult(transaction.objectStore(FILE_STORE).getAll());
		return files
			.filter((file) => /^[^/]+\.md$/.test(file.path))
			.map((file) => ({ id: file.path.replace(/\.md$/, ""), updatedAt: file.updatedAt }))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	async statNote(id: string): Promise<number | null> {
		return (await this.getFile(`${id}.md`))?.updatedAt ?? null;
	}

	async indexUpsert(item: NoteIndexPersistenceItem): Promise<void> {
		const database = await this.getDatabase();
		const transaction = database.transaction(INDEX_STORE, "readwrite");
		transaction.objectStore(INDEX_STORE).put(item);
		await transactionComplete(transaction);
	}

	async indexDelete(noteId: string): Promise<void> {
		const database = await this.getDatabase();
		const transaction = database.transaction(INDEX_STORE, "readwrite");
		transaction.objectStore(INDEX_STORE).delete(noteId);
		await transactionComplete(transaction);
	}

	async indexList(query: string, limit: number, offset = 0, filters?: NoteIndexQueryFilters): Promise<NoteIndexListResult> {
		const database = await this.getDatabase();
		const transaction = database.transaction(INDEX_STORE, "readonly");
		const items = await requestResult(transaction.objectStore(INDEX_STORE).getAll()) as NoteIndexPersistenceItem[];
		const term = query.trim().toLocaleLowerCase();
		const filtered = items.filter((item) => {
			if (term && !`${item.title} ${item.summary}`.toLocaleLowerCase().includes(term)) return false;
			if (filters?.noteTypes?.length && !filters.noteTypes.includes(item.noteType)) return false;
			if (filters?.status && item.status !== filters.status) return false;
			return !(filters?.hideDone && item.status === "done");
		}).sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt);
		const page = filtered.slice(offset, offset + limit);
		return { items: page, cursor: offset + page.length < filtered.length ? offset + page.length : undefined };
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		const startedAt = Date.now();
		const files = await this.listNoteFiles();
		const database = await this.getDatabase();
		const transaction = database.transaction(INDEX_STORE, "readwrite");
		const store = transaction.objectStore(INDEX_STORE);
		store.clear();
		for (const file of files) {
			const note = await this.loadNote(file.id);
			if (!note) continue;
			store.put({ noteId: note.id, title: note.title, summary: note.content, isPinned: note.isPinned, updatedAt: note.lastUpdated, noteType: note.noteType, status: note.status } satisfies NoteIndexPersistenceItem);
		}
		await transactionComplete(transaction);
		return { noteCount: files.length, totalMs: Date.now() - startedAt };
	}
}
