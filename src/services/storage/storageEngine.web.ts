import { PlatformStorageEngine } from "@/services/storage/engines/StorageEngine";
import { BrowserStorageEngine } from "@/services/storage/engines/BrowserStorageEngine.web";
import { MemoryStorageEngine } from "@/services/storage/engines/MemoryStorageEngine.web";
import { getTauriInvoke } from "@/services/storage/runtime";
import type { StorageEngine, StorageInitializeResult } from "@/services/storage/types";

let _engine: StorageEngine | null = null;

function getEngine(): StorageEngine {
	if (!_engine) {
		_engine = getTauriInvoke()
			? new PlatformStorageEngine()
			: new BrowserStorageEngine();
	}
	return _engine;
}

async function initializeEngine(): Promise<StorageInitializeResult> {
	const engine = getEngine();
	try {
		return await engine.initialize();
	} catch (error) {
		if (
			engine instanceof BrowserStorageEngine &&
			error instanceof Error &&
			error.message.startsWith("Browser storage is unavailable:")
		) {
			_engine = new MemoryStorageEngine();
			return _engine.initialize();
		}
		throw error;
	}
}

export const storageEngine: StorageEngine = new Proxy({} as StorageEngine, {
	get(_target, prop) {
		if (prop === "initialize") return initializeEngine;
		const engine = getEngine();
		return Reflect.get(engine, prop);
	},
});

export function getStorageEngine(): StorageEngine {
	return getEngine();
}
