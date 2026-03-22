import { GitService } from "@/services/git/gitService";
import { getStorageEngine } from "@/services/storage/storageEngine";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useEditorState } from "@/stores/editorStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

let resetInFlight: Promise<void> | null = null;
export const FORCE_REPO_RESET_KEY = "app:forceRepoResetOnNextInit";

async function clearAsyncStorage(): Promise<void> {
	const keys = await AsyncStorage.getAllKeys();
	if (keys.length === 0) {
		return;
	}
	await AsyncStorage.multiRemove(keys);
}

export async function resetAppData(): Promise<void> {
	if (resetInFlight) {
		return resetInFlight;
	}

	resetInFlight = (async () => {
		GitService.clearQueuedChanges();
		useEditorState.getState().resetState();

		await getStorageEngine().resetAllData();
		await clearAsyncStorage();
		await AsyncStorage.setItem(FORCE_REPO_RESET_KEY, "1");

		GitService.clearQueuedChanges();
		useEditorState.getState().resetState();

		await StorageInitializationService.instance.initialize();
	})().finally(() => {
		resetInFlight = null;
	});

	return resetInFlight;
}
