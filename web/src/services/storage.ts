const DATABASE_NAME = "keeper-browser";
const STATE = "state";

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
export class BrowserStorage {
	private database: Promise<IDBDatabase> | null = null;
	private open(): Promise<IDBDatabase> {
		if (!this.database) {
			this.database = new Promise((resolve, reject) => {
				if (!("indexedDB" in globalThis)) return reject(new Error("IndexedDB is unavailable"));
				const request = indexedDB.open(DATABASE_NAME, 1);
				request.onupgradeneeded = () => {
					const db = request.result;
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
