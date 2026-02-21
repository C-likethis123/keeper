import {
	AppState,
	type AppStateStatus,
	type NativeEventSubscription,
} from "react-native";
import { type GitChangeOperation, commitChanges } from "./gitApi";

interface QueuedChange {
	filePath: string;
	operation: GitChangeOperation;
}

export class GitService {
	static readonly instance = new GitService();

	private static readonly queue = new Map<string, GitChangeOperation>();

	private appStateSubscription: NativeEventSubscription | null = null;
	private static isCommitting = false;

	private constructor() {
		this.appStateSubscription = AppState.addEventListener(
			"change",
			this.handleAppStateChange,
		);
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
			const result = await commitChanges(snapshot, message);
			if (!result.success) {
				console.warn("[GitService] Commit failed:", result.error);
			}
		} catch (error) {
			console.warn("[GitService] Commit batch threw:", error);
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
