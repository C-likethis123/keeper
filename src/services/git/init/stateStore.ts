import { FORCE_REPO_RESET_KEY } from "@/services/app/resetAppDataService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GitJournalEntry, GitSyncStateStore } from "./types";

const LAST_SYNCED_OID_KEY = "git:lastSyncedOid";
const PENDING_JOURNAL_KEY = "git:pendingJournal";

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
}
