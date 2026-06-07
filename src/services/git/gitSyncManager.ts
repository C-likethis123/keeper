import { NOTES_ROOT } from "@/services/notes/Notes";
import { exportFeedbackToFile } from "@/services/notes/clusterFeedbackService";
import { AppState, type AppStateStatus } from "react-native";
import { AsyncQueue } from "./asyncQueue";
import type { GitJournal } from "./gitJournal";
import type { GitNativeBridge } from "./gitNativeBridge";
import type { GitFlushResult, FlushOptions } from "./gitSyncTypes";
import type { GitJournalEntry } from "./init/types";

const COMMIT_DEBOUNCE_MS = 15000;

export class GitSyncManager {
	private commitTimeout: ReturnType<typeof setTimeout> | null = null;
	private inFlightFlush: Promise<GitFlushResult> | null = null;
	private backgroundSaveHandler: (() => Promise<void>) | null = null;
	private backgroundCommitPromise: Promise<void> | null = null;
	private reconcileHandler: (() => Promise<void>) | null = null;
	private readonly gitMutex = new AsyncQueue();

	constructor(
		private readonly journal: GitJournal,
		private readonly nativeBridge: GitNativeBridge,
	) {}

	withGitLock<T>(task: () => Promise<T>): Promise<T> {
		return this.gitMutex.run(task);
	}

	cancelScheduledCommit(): void {
		if (!this.commitTimeout) return;
		clearTimeout(this.commitTimeout);
		this.commitTimeout = null;
	}

	scheduleCommitBatch(delayMs = COMMIT_DEBOUNCE_MS): void {
		this.cancelScheduledCommit();
		this.commitTimeout = setTimeout(() => {
			this.commitTimeout = null;
			void this.flushPendingChanges({ reason: "app-background" });
		}, delayMs);
	}

	registerBackgroundSaveHandler(handler: (() => Promise<void>) | null): void {
		this.backgroundSaveHandler = handler;
	}

	async saveCurrentEditorBeforeBackgroundFlush(): Promise<void> {
		await this.backgroundSaveHandler?.();
	}

	registerReconcileHandler(handler: (() => Promise<void>) | null): void {
		this.reconcileHandler = handler;
	}

	triggerBackgroundCommit(reason: string): void {
		if (this.backgroundCommitPromise) return;

		this.cancelScheduledCommit();
		this.backgroundCommitPromise = this.runFlush(
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
				console.warn(`[GitService] Background commit error for ${reason}:`, error);
			})
			.finally(() => {
				this.backgroundCommitPromise = null;
			});
	}

	async prepareRecoveryForRemoteSync(): Promise<void> {
		return this.withGitLock(async () => {
			if (!(await this.journal.hasPending())) return;
			await this.journal.restorePendingChanges();
		});
	}

	async recoverPendingChanges(): Promise<GitFlushResult> {
		const restored = await this.journal.restorePendingChanges();
		if (!restored) {
			return {
				success: true,
				didCommit: false,
				didPush: false,
				didRecover: false,
			};
		}

		return this.flushPendingChanges({
			reason: "app-background",
			message: undefined,
			recovery: true,
		});
	}

	async flushPendingChanges(
		options: FlushOptions & { recovery?: boolean },
	): Promise<GitFlushResult> {
		if (!this.inFlightFlush) {
			this.inFlightFlush = this.runFlush(
				options.message,
				options.recovery ?? false,
			).finally(() => {
				this.inFlightFlush = null;
			});
		}

		try {
			return await this.withTimeout(this.inFlightFlush, options.timeoutMs);
		} catch (error) {
			const resolvedError = error instanceof Error ? error.message : String(error);
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

	async commitBatch(message?: string): Promise<void> {
		await this.flushPendingChanges({
			reason: "app-background",
			message,
		});
	}

	handleAppStateChange = (nextState: AppStateStatus) => {
		if (nextState === "active") return;

		void (async () => {
			try {
				await this.saveCurrentEditorBeforeBackgroundFlush();
			} catch (error) {
				console.warn("[GitService] Background save failed:", error);
			}

			try {
				await this.journal.logExitState("app-background");
			} catch (error) {
				console.warn("[GitService] Failed to log exit state:", error);
			}

			this.triggerBackgroundCommit("app-background");
		})();
	};

	createAppStateSubscription() {
		return AppState.addEventListener("change", this.handleAppStateChange);
	}

	private async runFlush(
		message?: string,
		recovery = false,
	): Promise<GitFlushResult> {
		return this.withGitLock(async () => {
			this.cancelScheduledCommit();

			const snapshot = await this.journal.read();
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
				const gitEngine = this.nativeBridge.getEngine();
				const status = await gitEngine.status(NOTES_ROOT);

				if (status.length > 0) {
					try {
						await exportFeedbackToFile();
					} catch (error) {
						console.warn("[GitService] Failed to export feedback:", error);
					}

					await gitEngine.commit(
						NOTES_ROOT,
						this.generateCommitMessage(snapshot, message, recovery),
					);
					didCommit = true;
				}

				await gitEngine.push(NOTES_ROOT);
				this.reconcileAfterPush();
				await this.journal.removeFlushedEntries(snapshot);

				return {
					success: true,
					didCommit,
					didPush: true,
					didRecover: recovery,
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.warn("[GitService] Commit/push batch failed:", error);
				return {
					success: false,
					didCommit,
					didPush: false,
					error: errorMsg,
					didRecover: recovery,
				};
			}
		});
	}

	private reconcileAfterPush(): void {
		if (!this.reconcileHandler) return;

		const reconcileHandler = this.reconcileHandler;
		void this.withGitLock(() =>
			reconcileHandler().catch((err) =>
				console.warn("[GitService] Reconcile failed:", err),
			),
		);
	}

	private generateCommitMessage(
		snapshot: GitJournalEntry[],
		message?: string,
		recovery = false,
	): string {
		if (message) return message;
		if (!recovery) return `Update ${snapshot.length} file(s)`;

		const exitLog = snapshot.find((entry) => entry.exitLog)?.exitLog;
		if (exitLog) {
			return `Recover ${snapshot.length} file(s) from ${exitLog.reason} exit (auto-committed on restart)`;
		}
		return `Recover pending local note changes (${snapshot.length} files)`;
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
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
}
