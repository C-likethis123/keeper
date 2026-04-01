import { NOTES_ROOT } from "@/services/notes/Notes";
import {
	AppState,
	type AppStateStatus,
	type NativeEventSubscription,
} from "react-native";
import type { GitEngine } from "./engines/GitEngine";
import { getGitEngine } from "./gitEngine";

type GitChangeOperation = "add" | "modify" | "delete";
type FlushReason = "note-exit" | "delete" | "app-background";

interface QueuedChange {
	filePath: string;
	operation: GitChangeOperation;
}

export interface GitFlushResult {
	success: boolean;
	didCommit: boolean;
	didPush: boolean;
	error?: string;
}

interface FlushOptions {
	reason: FlushReason;
	timeoutMs?: number;
	message?: string;
}

const COMMIT_DEBOUNCE_MS = 15000;

export class GitService {
	static readonly instance = new GitService();

	private static readonly queue = new Map<string, GitChangeOperation>();
	private static gitEngine: GitEngine | null = null;
	private static commitTimeout: ReturnType<typeof setTimeout> | null = null;
	private static inFlightFlush: Promise<GitFlushResult> | null = null;
	private static backgroundSaveHandler: (() => Promise<void>) | null = null;

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

	static queueChange(filePath: string, operation: GitChangeOperation): void {
		if (!filePath) {
			return;
		}

		const previous = GitService.queue.get(filePath);

		if (!previous) {
			GitService.queue.set(filePath, operation);
			return;
		}

		if (previous === "add" && operation === "modify") {
			GitService.queue.set(filePath, "add");
			return;
		}

		if (previous === "modify" && operation === "delete") {
			GitService.queue.set(filePath, "delete");
			return;
		}

		if (previous === "add" && operation === "delete") {
			GitService.queue.delete(filePath);
			return;
		}

		GitService.queue.set(filePath, operation);
	}

	static clearQueuedChanges(): void {
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
			GitService.commitTimeout = null;
		}
		GitService.queue.clear();
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

	private static async runFlush(message?: string): Promise<GitFlushResult> {
		if (GitService.commitTimeout) {
			clearTimeout(GitService.commitTimeout);
			GitService.commitTimeout = null;
		}
		if (GitService.queue.size === 0) {
			return {
				success: true,
				didCommit: false,
				didPush: false,
			};
		}

		const snapshot: QueuedChange[] = [];
		for (const [filePath, operation] of GitService.queue.entries()) {
			snapshot.push({ filePath, operation });
		}
		GitService.queue.clear();
		let didCommit = false;

		try {
			const gitEngine = GitService.ensureGitEngine();
			const status = await gitEngine.status(NOTES_ROOT);
			if (status.length > 0) {
				const commitMessage = message || `Update ${snapshot.length} file(s)`;
				await gitEngine.commit(NOTES_ROOT, commitMessage);
				didCommit = true;
			}
			await gitEngine.push(NOTES_ROOT);
			return {
				success: true,
				didCommit,
				didPush: true,
			};
		} catch (error) {
			for (const change of snapshot) {
				GitService.queueChange(change.filePath, change.operation);
			}
			const resolvedError =
				error instanceof Error ? error.message : String(error);
			console.warn("[GitService] Commit/push batch failed:", error);
			return {
				success: false,
				didCommit,
				didPush: false,
				error: resolvedError,
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
		options: FlushOptions,
	): Promise<GitFlushResult> {
		if (!GitService.inFlightFlush) {
			GitService.inFlightFlush = GitService.runFlush(options.message).finally(
				() => {
					GitService.inFlightFlush = null;
				},
			);
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
			void (async () => {
				try {
					await GitService.backgroundSaveHandler?.();
				} catch (error) {
					console.warn("[GitService] Background save failed:", error);
				}
				await GitService.flushPendingChanges({
					reason: "app-background",
					timeoutMs: 8000,
				});
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
