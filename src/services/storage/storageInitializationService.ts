import { setNotesRoot } from "@/services/notes/Notes";
import {
	getStorageCapabilities,
	getStorageEngine,
} from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";

interface StorageInitializationResult {
	needsRebuild: boolean;
}

export class StorageInitializationService {
	static readonly instance = new StorageInitializationService();

	private constructor() {}

	async initialize(): Promise<StorageInitializationResult> {
		useStorageStore.getState().setInitializationPending();
		try {
			const result = await getStorageEngine().initialize();
			useStorageStore.getState().setCapabilities(getStorageCapabilities());
			setNotesRoot(result.notesRoot);
			useStorageStore.getState().setNotesRoot(result.notesRoot);
			useStorageStore.getState().setInitializationReady();
			return {
				needsRebuild: result.needsRebuild,
			};
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: "Native storage initialization failed";
			useStorageStore.getState().setInitializationFailed(reason);
			throw new Error(reason);
		}
	}
}
