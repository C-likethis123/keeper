import { MobileStorageEngine } from "@/services/storage/engines/MobileStorageEngine";
import type { StorageEngine } from "@/services/storage/engines/StorageEngine";
import { TauriStorageEngine } from "@/services/storage/engines/TauriStorageEngine";
import { getRuntimeStorageBackend, isTauriRuntime } from "@/services/storage/runtime";

let storageEngine: StorageEngine | null = null;

export function getStorageEngine(): StorageEngine {
	if (storageEngine) {
		return storageEngine;
	}

	storageEngine = isTauriRuntime()
		? new TauriStorageEngine()
		: new MobileStorageEngine();
	return storageEngine;
}

export function getStorageCapabilities() {
	return {
		backend: getRuntimeStorageBackend(),
		canWrite: true,
		canSearch: true,
	} as const;
}
