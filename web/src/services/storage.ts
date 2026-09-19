const DATABASE_NAME = "keeper-browser";
const FILES = "files";
const STATE = "state";

type StoredFile = { path: string; bytes: ArrayBuffer; updatedAt: number };
type StoredState = { key: string; value: string };

function result<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});
}
function committed(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
	});
}
function safePath(path: string): string {
	const parts = path.split("/").filter(Boolean);
	if (path.startsWith("/") || !parts.length || parts.some((part) => part === "." || part === "..")) throw new Error("Path must remain inside browser storage");
	return parts.join("/");
}
function copyBytes(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export class BrowserStorage {
	private database: Promise<IDBDatabase> | null = null;
	private open(): Promise<IDBDatabase> {
		if (!this.database) {
			this.database = new Promise((resolve, reject) => {
				if (!("indexedDB" in globalThis)) return reject(new Error("IndexedDB is unavailable"));
				const request = indexedDB.open(DATABASE_NAME, 1);
				request.onupgradeneeded = () => {
					const db = request.result;
					if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "path" });
					if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE, { keyPath: "key" });
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
				request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab"));
			});
			void this.database.catch(() => { this.database = null; });
		}
		return this.database;
	}
	async readFile(path: string): Promise<Uint8Array | null> {
		const tx = (await this.open()).transaction(FILES, "readonly");
		const entry = await result(tx.objectStore(FILES).get(safePath(path)) as IDBRequest<StoredFile | undefined>);
		return entry ? new Uint8Array(entry.bytes) : null;
	}
	async writeFile(path: string, bytes: Uint8Array): Promise<void> {
		const tx = (await this.open()).transaction(FILES, "readwrite");
		tx.objectStore(FILES).put({ path: safePath(path), bytes: copyBytes(bytes), updatedAt: Date.now() } satisfies StoredFile);
		await committed(tx);
	}
	async deleteFile(path: string): Promise<void> {
		const tx = (await this.open()).transaction(FILES, "readwrite");
		tx.objectStore(FILES).delete(safePath(path));
		await committed(tx);
	}
	async listFiles(prefix = ""): Promise<string[]> {
		const tx = (await this.open()).transaction(FILES, "readonly");
		const keys = await result(tx.objectStore(FILES).getAllKeys());
		return keys.filter((key): key is string => typeof key === "string" && key.startsWith(prefix));
	}
	async getState(key: string): Promise<string | null> {
		const tx = (await this.open()).transaction(STATE, "readonly");
		return (await result(tx.objectStore(STATE).get(key) as IDBRequest<StoredState | undefined>))?.value ?? null;
	}
	async setState(key: string, value: string): Promise<void> {
		const tx = (await this.open()).transaction(STATE, "readwrite");
		tx.objectStore(STATE).put({ key, value } satisfies StoredState);
		await committed(tx);
	}
}

export const browserStorage = new BrowserStorage();
