import { GitService } from "@/services/git/gitService";
import { storageEngine } from "@/services/storage/storageEngine";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useEditorState } from "@/stores/editorStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

let resetInFlight: Promise<void> | null = null;
export const FORCE_REPO_RESET_KEY = "app:forceRepoResetOnNextInit";

export async function resetAppData(): Promise<void> {
  if (resetInFlight) {
    return resetInFlight;
  }

  resetInFlight = (async () => {
    GitService.clearQueuedChanges();
    useEditorState.getState().resetState();
    await storageEngine().resetAllData();
    await AsyncStorage.clear();
    await AsyncStorage.setItem(FORCE_REPO_RESET_KEY, "1");

    GitService.clearQueuedChanges();
    useEditorState.getState().resetState();

    await StorageInitializationService.instance.initialize();
  })().finally(() => {
    resetInFlight = null;
  });

  return resetInFlight;
}
