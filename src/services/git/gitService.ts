import { NOTES_ROOT } from "@/services/notes/Notes";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { storageEngine } from "@/services/storage/storageEngine";
import {
	AppState,
	type AppStateStatus,
	type NativeEventSubscription,
} from "react-native";
import type { GitEngine } from "./engines/GitEngine";
import { getGitEngine } from "./gitEngine";
import { AsyncGitSyncStateStore } from "./init/stateStore";
import type {
	GitExitLog,
	GitJournalEntry,
	GitJournalOperation,
} from "./init/types";

type FlushReason = "note-exit" | "delete" | "app-background";

export interface GitFlushResult {
	success: boolean;
	didCommit: boolean;
	didPush: boolean;
	error?: string;
	didRecover?: boolean;
}

interface FlushOptions {
	reason: FlushReason;
	timeoutMs?: number;
	message?: string;
}

const COMMIT_DEBOUNCE_MS = 15000;

export class GitService {
	static readonly instance = new GitService();

	private static gitEngine: GitEngine | null = null;
	private static stateStore = new AsyncGitSyncStateStore();
	private static commitTimeout: ReturnType<typeof setTimeout> | null = null;
	private static inFlightFlush: Promise<GitFlushResult> | null = null;
	private static backgroundSaveHandler: (() => Promise<void>) | null = null;
	private static backgroundCommitPromise: Promise<void> | null = null;

	private appStateSubscription: NativeEventSubscription | null = null;

	private constructor() {
		this.appStateSubscription = AppState.addEventListener(
			"change",
			this.handleAppStateChange,
		);
	}

	private static ensureGitEngine(): GitEngine {
		if (GitService.gitEngine) {
			return GitService.gitEngine;
		}
		GitService.gitEngine = getGitEngine();
		return GitService.gitEngine;
	}

	static queueChange(filePath: string, operation: GitJournalOperation): void {
		void GitService.queueChangeAsync(filePath, operation);
	}

	static async queueChangeAsync(
		filePath: string,
		operation: GitJournalOperation,
		note?: GitJournalEntry["note"],
	): Promise<void> {
		if (!filePath) {
			return;
		}

		const journal = await GitService.stateStore.readPendingJournal();
		const queue = new Map(
			journal.map((entry) => [entry.filePath, entry] as const),
		);
		const previous = queue.get(filePath);

		if (!previous) {
			queue.set(filePath, {
				filePath,
				operation,
				note,
				updatedAt: Date.now(),
			});
			await GitService.persistQueue(queue);
			return;
		}

		if (previous.operation === "add" && operation === "modify") {
			queue.set(filePath, {
				...previous,
				note,
				updatedAt: Date.now(),
			});
			await GitService.persistQueue(queue);
			return;
		}

		if (previous.operation === "modify" && operation === "delete") {
			queue.set(filePath, {
				filePath,
				operation: "delete",
				updatedAt: Date.now(),
			});
			await GitService.persistQueue(queue);
			return;
		}

		if (previous.operation === "add" && operation === "delete") {
			queue.delete(filePath);
			await GitService.persistQueue(queue);
			return;
		}

		queue.set(filePath, {
			filePath,
			operation,
			note,
			updatedAt: Date.now(),
		});
		await GitService.persistQueue(queue);
	}

	static clearQueuedChanges(): void {
		void GitService.clearQueuedChangesAsync();
	}

	static async clearQueuedChangesAsync(): Promise<void> {
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
			GitService.commitTimeout = null;
		}
		await GitService.stateStore.writePendingJournal([]);
	}

	static scheduleCommitBatch(delayMs = COMMIT_DEBOUNCE_MS): void {
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
		}
		GitService.commitTimeout = setTimeout(() => {
			GitService.commitTimeout = null;
			void GitService.flushPendingChanges({ reason: "app-background" });
		}, delayMs);
	}

	static registerBackgroundSaveHandler(
		handler: (() => Promise<void>) | null,
	): void {
		GitService.backgroundSaveHandler = handler;
	}

	private static async persistQueue(
		queue: Map<string, GitJournalEntry>,
	): Promise<void> {
		await GitService.stateStore.writePendingJournal([...queue.values()]);
	}

	/**
	 * Log the current exit state to the journal without waiting for flush.
	 * This records metadata about why the app is exiting, which helps with
	 * recovery and debugging. The actual commit happens asynchronously.
	 */
	private static async logExitState(
		reason: FlushReason,
		documentVersion?: number,
	): Promise<void> {
		const journal = await GitService.stateStore.readPendingJournal();
		if (journal.length === 0) {
			// No pending changes, nothing to log
			return;
		}

		const exitLog: GitExitLog = {
			timestamp: Date.now(),
			reason,
			documentVersion,
		};

		// Attach exit log to all entries in the journal
		const updatedJournal = journal.map((entry) => ({
			...entry,
			exitLog: entry.exitLog ?? exitLog,
		}));

		await GitService.stateStore.writePendingJournal(updatedJournal);
	}

	/**
	 * Trigger a background commit/push without blocking the caller.
	 * This is a fire-and-forget operation that uses the same runFlush() logic
	 * but doesn't block app exit. If the commit fails, the journal persists
	 * and will be retried on next app launch.
	 */
	static triggerBackgroundCommit(reason: string): void {
		// If there's already a background commit in progress, don't start another
		if (GitService.backgroundCommitPromise) {
			return;
		}

		// Clear any pending debounce timer since we're committing now
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
			GitService.commitTimeout = null;
		}

		// Fire and forget - don't await
		GitService.backgroundCommitPromise = GitService.runFlush(
			`Auto-committed after ${reason}`,
			false,
		)
			.then((result) => {
				if (!result.success) {
					console.warn(
						`[GitService] Background commit failed for ${reason}:`,
						result.error,
					);
				}
			})
			.catch((error) => {
				console.warn(
					`[GitService] Background commit error for ${reason}:`,
					error,
				);
			})
			.finally(() => {
				GitService.backgroundCommitPromise = null;
			});
	}

	static async hasPendingJournal(): Promise<boolean> {
		const journal = await GitService.stateStore.readPendingJournal();
		return journal.length > 0;
	}

	/**
	 * Check if the journal contains exit logs from a previous session.
	 * This indicates the app exited without completing a commit.
	 */
	static async hasExitLogInJournal(): Promise<boolean> {
		const journal = await GitService.stateStore.readPendingJournal();
		return journal.some((entry) => entry.exitLog != null);
	}

	/**
	 * Get the most recent exit log from the journal, if any.
	 */
	static async getLatestExitLogFromJournal(): Promise<GitExitLog | null> {
		const journal = await GitService.stateStore.readPendingJournal();
		let latest: GitExitLog | null = null;
		for (const entry of journal) {
			if (
				entry.exitLog &&
				(!latest || entry.exitLog.timestamp > latest.timestamp)
			) {
				latest = entry.exitLog;
			}
		}
		return latest;
	}

	static async prepareRecoveryForRemoteSync(): Promise<void> {
		const journal = await GitService.stateStore.readPendingJournal();
		if (journal.length === 0) {
			return;
		}

		const gitEngine = GitService.ensureGitEngine();
		await gitEngine.checkout(NOTES_ROOT, "HEAD", {
			noUpdateHead: true,
			force: true,
		});
	}

	static async restorePendingChangesFromJournal(): Promise<boolean> {
		const journal = await GitService.stateStore.readPendingJournal();
		if (journal.length === 0) {
			return false;
		}

		let restored = false;
		for (const entry of journal) {
			if (entry.operation === "delete") {
				const noteId = entry.filePath.replace(/\.md$/, "");
				await storageEngine.deleteNote(noteId);
				await NotesIndexService.deleteNote(noteId);
				restored = true;
				continue;
			}

			if (!entry.note) {
				continue;
			}

			const saved = await storageEngine.saveNote(entry.note);
			await NotesIndexService.upsertNote({
				noteId: saved.id,
				summary: extractSummary(saved.content),
				title: saved.title,
				isPinned: saved.isPinned,
				updatedAt: saved.lastUpdated,
				noteType: saved.noteType,
				status: saved.status ?? null,
			});
			restored = true;
		}

		return restored;
	}

	static async recoverPendingChanges(): Promise<GitFlushResult> {
		const restored = await GitService.restorePendingChangesFromJournal();
		if (!restored) {
			return {
				success: true,
				didCommit: false,
				didPush: false,
				didRecover: false,
			};
		}

		return GitService.flushPendingChanges({
			reason: "app-background",
			message: undefined,
			recovery: true,
		});
	}

	private static async runFlush(
		message?: string,
		recovery = false,
	): Promise<GitFlushResult> {
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
			GitService.commitTimeout = null;
		}
		const snapshot = await GitService.stateStore.readPendingJournal();
		if (snapshot.length === 0) {
			return {
				success: true,
				didCommit: false,
				didPush: false,
				didRecover: false,
			};
		}
		let didCommit = false;

		try {
			const gitEngine = GitService.ensureGitEngine();
			const status = await gitEngine.status(NOTES_ROOT);
			if (status.length > 0) {
				let commitMessage = message;
				if (!commitMessage) {
					if (recovery) {
						// Check if we're recovering from an exit log
						const exitLog = snapshot.find((e) => e.exitLog)?.exitLog;
						if (exitLog) {
							commitMessage = `Recover ${snapshot.length} file(s) from ${exitLog.reason} exit (auto-committed on restart)`;
						} else {
							commitMessage = `Recover pending local note changes (${snapshot.length} files)`;
						}
					} else {
						commitMessage = `Update ${snapshot.length} file(s)`;
					}
				}
				await gitEngine.commit(NOTES_ROOT, commitMessage);
				didCommit = true;
			}
			await gitEngine.push(NOTES_ROOT);
			await GitService.stateStore.writePendingJournal([]);
			return {
				success: true,
				didCommit,
				didPush: true,
				didRecover: recovery,
			};
		} catch (error) {
			const resolvedError =
				error instanceof Error ? error.message : String(error);
			console.warn("[GitService] Commit/push batch failed:", error);
			return {
				success: false,
				didCommit,
				didPush: false,
				error: resolvedError,
				didRecover: recovery,
			};
		}
	}

	private static withTimeout<T>(
		promise: Promise<T>,
		timeoutMs?: number,
	): Promise<T> {
		if (!timeoutMs || timeoutMs <= 0) {
			return promise;
		}

		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Git flush timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			void promise.then(
				(value) => {
					clearTimeout(timeout);
					resolve(value);
				},
				(error) => {
					clearTimeout(timeout);
					reject(error);
				},
			);
		});
	}

	static async flushPendingChanges(
		options: FlushOptions & { recovery?: boolean },
	): Promise<GitFlushResult> {
		if (!GitService.inFlightFlush) {
			GitService.inFlightFlush = GitService.runFlush(
				options.message,
				options.recovery ?? false,
			).finally(() => {
				GitService.inFlightFlush = null;
			});
		}

		try {
			return await GitService.withTimeout(
				GitService.inFlightFlush,
				options.timeoutMs,
			);
		} catch (error) {
			const resolvedError =
				error instanceof Error ? error.message : String(error);
			console.warn(
				`[GitService] Flush failed for ${options.reason}:`,
				resolvedError,
			);
			return {
				success: false,
				didCommit: false,
				didPush: false,
				error: resolvedError,
				didRecover: options.recovery ?? false,
			};
		}
	}

	static async commitBatch(message?: string): Promise<void> {
		await GitService.flushPendingChanges({
			reason: "app-background",
			message,
		});
	}

	private handleAppStateChange = (nextState: AppStateStatus) => {
		if (nextState !== "active") {
			// Fire-and-forget: log exit state and trigger background commit
			// The app can exit immediately without waiting for git operations
			void (async () => {
				try {
					// Persist current editor state to disk
					await GitService.backgroundSaveHandler?.();
				} catch (error) {
					console.warn("[GitService] Background save failed:", error);
				}

				try {
					// Log the exit state to journal (non-blocking)
					await GitService.logExitState("app-background");
				} catch (error) {
					console.warn("[GitService] Failed to log exit state:", error);
				}

				// Trigger background commit without blocking app exit
				GitService.triggerBackgroundCommit("app-background");
			})();
		}
	};

	dispose(): void {
		if (this.appStateSubscription) {
			this.appStateSubscription.remove();
			this.appStateSubscription = null;
		}
	}
}
