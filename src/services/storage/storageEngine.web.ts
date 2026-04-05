import type { StorageEngine } from "@/services/storage/engines/StorageEngine";
import { TauriStorageEngine } from "@/services/storage/engines/TauriStorageEngine";

export const storageEngine: StorageEngine = new TauriStorageEngine();
