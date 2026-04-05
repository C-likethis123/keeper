import { setNotesRoot } from "@/services/notes/Notes";
import { storageEngine } from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";

interface StorageInitializationResult {
  needsRebuild: boolean;
}

export class StorageInitializationService {
  static readonly instance = new StorageInitializationService();

  private constructor() {}

  async initialize(force = false): Promise<StorageInitializationResult> {
    useStorageStore.getState().setInitializationPending();
    try {
      const result = await storageEngine.initialize();
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
