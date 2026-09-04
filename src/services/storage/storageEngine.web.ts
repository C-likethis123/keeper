import { PlatformStorageEngine } from "@/services/storage/engines/StorageEngine";
import { BrowserStorageEngine } from "@/services/storage/engines/BrowserStorageEngine.web";
import { getTauriInvoke } from "@/services/storage/runtime";
import type { StorageEngine } from "@/services/storage/types";

let _engine: StorageEngine | null = null;

function getEngine(): StorageEngine {
	if (!_engine) {
		_engine = getTauriInvoke()
			? new PlatformStorageEngine()
			: new BrowserStorageEngine();
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
