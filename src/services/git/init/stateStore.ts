import { FORCE_REPO_RESET_KEY } from "@/services/app/resetAppDataService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GitJournalEntry, GitSyncStateStore } from "./types";

const LAST_SYNCED_OID_KEY = "git:lastSyncedOid";
const PENDING_JOURNAL_KEY = "git:pendingJournal";
const DEVICE_ID_KEY = "git:deviceId";
const DEVICE_BRANCH_KEY = "git:deviceBranch";
const LAST_RECONCILED_MAIN_OID_KEY = "git:lastReconciledMainOid";

export class AsyncGitSyncStateStore implements GitSyncStateStore {
	private async read(key: string): Promise<string | undefined> {
		try {
			const val = await AsyncStorage.getItem(key);
			return val ?? undefined;
		} catch {
			return undefined;
		}
	}

	private async write(key: string, value: string, label: string): Promise<void> {
		try {
			await AsyncStorage.setItem(key, value);
		} catch (err) {
			console.warn(`[GitSyncStateStore] Failed to persist ${label}:`, err);
		}
	}

	async readLastSyncedOid(): Promise<string | undefined> {
		return this.read(LAST_SYNCED_OID_KEY);
	}

	async writeLastSyncedOid(oid: string): Promise<void> {
		return this.write(LAST_SYNCED_OID_KEY, oid, "lastSyncedOid");
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

	async readPendingJournal(): Promise<GitJournalEntry[]> {
		try {
			const raw = await AsyncStorage.getItem(PENDING_JOURNAL_KEY);
			if (!raw) {
				return [];
			}

			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}

			return parsed.filter((entry): entry is GitJournalEntry => {
				if (!entry || typeof entry !== "object") {
					return false;
				}

				return (
					typeof entry.filePath === "string" &&
					(entry.operation === "add" ||
						entry.operation === "modify" ||
						entry.operation === "delete") &&
					typeof entry.updatedAt === "number"
				);
			});
		} catch {
			return [];
		}
	}

	async writePendingJournal(entries: GitJournalEntry[]): Promise<void> {
		try {
			if (entries.length === 0) {
				await AsyncStorage.removeItem(PENDING_JOURNAL_KEY);
				return;
			}

			await AsyncStorage.setItem(PENDING_JOURNAL_KEY, JSON.stringify(entries));
		} catch (err) {
			console.warn(
				"[GitInitializationService] Failed to persist journal:",
				err,
			);
		}
	}

	async readDeviceId(): Promise<string | undefined> {
		return this.read(DEVICE_ID_KEY);
	}

	async writeDeviceId(id: string): Promise<void> {
		return this.write(DEVICE_ID_KEY, id, "deviceId");
	}

	async readDeviceBranch(): Promise<string | undefined> {
		return this.read(DEVICE_BRANCH_KEY);
	}

	async writeDeviceBranch(branch: string): Promise<void> {
		return this.write(DEVICE_BRANCH_KEY, branch, "deviceBranch");
	}

	async readLastReconciledMainOid(): Promise<string | undefined> {
		return this.read(LAST_RECONCILED_MAIN_OID_KEY);
	}

	async writeLastReconciledMainOid(oid: string): Promise<void> {
		return this.write(LAST_RECONCILED_MAIN_OID_KEY, oid, "lastReconciledMainOid");
	}
}
