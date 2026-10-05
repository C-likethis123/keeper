import { storageEngine } from "@/services/storage/storageEngine";

const SYNC_STATE_ROOT = ".keeper/sync-state";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function statePath(key: string): string {
	return `${SYNC_STATE_ROOT}/${encodeURIComponent(key)}`;
}

export async function getSyncStateItem(key: string): Promise<string | null> {
	const bytes = await storageEngine.readFileBytes(statePath(key));
	return bytes ? decoder.decode(bytes) : null;
}

export async function setSyncStateItem(
	key: string,
	value: string,
): Promise<void> {
	await storageEngine.writeFileBytes(statePath(key), encoder.encode(value));
}
