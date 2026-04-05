import type { StorageEngine } from "@/services/storage/engines/StorageEngine";
import { MobileStorageEngine } from "@/services/storage/engines/MobileStorageEngine";

export const storageEngine: StorageEngine = new MobileStorageEngine();
