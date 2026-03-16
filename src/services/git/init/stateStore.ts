import { FORCE_REPO_RESET_KEY } from "@/services/app/resetAppDataService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GitSyncStateStore } from "./types";

const LAST_SYNCED_OID_KEY = "git:lastSyncedOid";

export class AsyncGitSyncStateStore implements GitSyncStateStore {
	async readLastSyncedOid(): Promise<string | undefined> {
		try {
			const val = await AsyncStorage.getItem(LAST_SYNCED_OID_KEY);
			return val ?? undefined;
		} catch {
			return undefined;
		}
	}

	async writeLastSyncedOid(oid: string): Promise<void> {
		try {
			await AsyncStorage.setItem(LAST_SYNCED_OID_KEY, oid);
		} catch (err) {
			console.warn(
				"[GitInitializationService] Failed to persist lastSyncedOid:",
				err,
			);
		}
	}

	async shouldForceRepoReset(): Promise<boolean> {
		try {
			return (await AsyncStorage.getItem(FORCE_REPO_RESET_KEY)) === "1";
		} catch {
			return false;
		}
	}

	async clearForceRepoResetFlag(): Promise<void> {
		try {
			await AsyncStorage.removeItem(FORCE_REPO_RESET_KEY);
		} catch {
			// ignore marker cleanup failures
		}
	}
}
