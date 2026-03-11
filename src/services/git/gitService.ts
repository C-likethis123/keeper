import {
	AppState,
	type AppStateStatus,
	type NativeEventSubscription,
} from "react-native";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { GitEngine } from "./engines/GitEngine";
import { getGitEngine } from "./gitEngine";

type GitChangeOperation = "add" | "modify" | "delete";

interface QueuedChange {
	filePath: string;
	operation: GitChangeOperation;
}

export class GitService {
	static readonly instance = new GitService();

	private static readonly queue = new Map<string, GitChangeOperation>();
	private static gitEngine: GitEngine | null = null;

	private appStateSubscription: NativeEventSubscription | null = null;
	private static isCommitting = false;

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

	static async commitBatch(message?: string): Promise<void> {
		if (GitService.isCommitting || GitService.queue.size === 0) {
			return;
		}

		GitService.isCommitting = true;

		const snapshot: QueuedChange[] = [];
		for (const [filePath, operation] of GitService.queue.entries()) {
			snapshot.push({ filePath, operation });
		}
		GitService.queue.clear();

		try {
			const gitEngine = GitService.ensureGitEngine();
			const status = await gitEngine.status(NOTES_ROOT);
			if (status.length > 0) {
				const commitMessage = message || `Update ${snapshot.length} file(s)`;
				await gitEngine.commit(NOTES_ROOT, commitMessage);
			}
			await gitEngine.push(NOTES_ROOT);
		} catch (error) {
			for (const change of snapshot) {
				GitService.queueChange(change.filePath, change.operation);
			}
			console.warn("[GitService] Commit/push batch failed:", error);
		} finally {
			GitService.isCommitting = false;
		}
	}

	private handleAppStateChange = (nextState: AppStateStatus) => {
		if (nextState !== "active") {
			void GitService.commitBatch();
		}
	};

	dispose(): void {
		if (this.appStateSubscription) {
			this.appStateSubscription.remove();
			this.appStateSubscription = null;
		}
	}
}
