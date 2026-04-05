import type { StorageEngine } from "@/services/storage/engines/StorageEngine";
import { TauriStorageEngine } from "@/services/storage/engines/TauriStorageEngine";

let _engine: StorageEngine | null = null;

function getEngine(): StorageEngine {
	if (!_engine) {
		_engine = new TauriStorageEngine();
	}
	return _engine;
}

export const storageEngine: StorageEngine = new Proxy({} as StorageEngine, {
	get(_target, prop) {
		const engine = getEngine();
		return Reflect.get(engine, prop);
	},
});

export function getStorageEngine(): StorageEngine {
	return getEngine();
}
