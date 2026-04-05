import { MobileStorageEngine } from "@/services/storage/engines/MobileStorageEngine";
import type { StorageEngine } from "@/services/storage/engines/StorageEngine";

export const storageEngine: StorageEngine = new MobileStorageEngine();
