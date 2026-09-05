import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTauriInvoke } from "@/services/storage/runtime";
import { storageEngine } from "@/services/storage/storageEngine";

const SYNC_STATE_PATH = "sync/state.json";

type SyncState = Record<string, string>;

let desktopStatePromise: Promise<SyncState> | null = null;

function isDesktopRuntime(): boolean {
	return getTauriInvoke() !== null;
}

async function loadDesktopState(): Promise<SyncState> {
	const bytes = await storageEngine.readFileBytes(SYNC_STATE_PATH);
	if (!bytes) return {};

	try {
		const parsed = JSON.parse(new TextDecoder().decode(bytes));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return Object.fromEntries(
			Object.entries(parsed).filter((entry): entry is [string, string] =>
				typeof entry[1] === "string",
			),
		);
	} catch {
		return {};
	}
}

async function getDesktopState(): Promise<SyncState> {
	if (!desktopStatePromise) {
		desktopStatePromise = loadDesktopState();
	}
	return desktopStatePromise;
}

/**
 * Keeps Tauri sync state beside Tauri notes. The production desktop webview
 * gets a fresh localhost port on launch, so browser localStorage is not stable.
 */
export async function getSyncStateItem(key: string): Promise<string | null> {
	if (!isDesktopRuntime()) return AsyncStorage.getItem(key);
	return (await getDesktopState())[key] ?? null;
}

export async function setSyncStateItem(
	key: string,
	value: string,
): Promise<void> {
	if (!isDesktopRuntime()) {
		await AsyncStorage.setItem(key, value);
		return;
	}

	const state = await getDesktopState();
	state[key] = value;
	await storageEngine.writeFileBytes(
		SYNC_STATE_PATH,
		new TextEncoder().encode(JSON.stringify(state)),
	);
}
