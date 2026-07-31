import { getStorageEngine } from "@/services/storage/storageEngine";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

let resetInFlight: Promise<void> | null = null;
export async function resetAppData(): Promise<void> {
	if (resetInFlight) {
		return resetInFlight;
	}

	resetInFlight = (async () => {
		await getStorageEngine().resetAllData();
		await AsyncStorage.clear();
		await StorageInitializationService.instance.initialize();
	})().finally(() => {
		resetInFlight = null;
	});

	return resetInFlight;
}
