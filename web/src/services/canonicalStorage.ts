import { storageEngine } from "@/services/storage/storageEngine";

let initialization: Promise<void> | null = null;

export function ensureCanonicalStorageInitialized(): Promise<void> {
	if (!initialization) {
		initialization = storageEngine.initialize().then(() => undefined);
		void initialization.catch(() => {
			initialization = null;
		});
	}
	return initialization;
}
