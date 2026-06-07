import { PlatformStorageEngine } from "@/services/storage/engines/StorageEngine";
import type { StorageEngine } from "@/services/storage/types";

export const storageEngine: StorageEngine = new PlatformStorageEngine();

// Alias for compatibility
export const getStorageEngine = () => storageEngine;
