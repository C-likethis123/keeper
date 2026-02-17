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

	private readonly commitIntervalMs = 5 * 60 * 1000;
	private readonly queue = new Map<string, GitChangeOperation>();

	private commitIntervalId: number | null = null;
	private appStateSubscription: NativeEventSubscription | null = null;
	private isCommitting = false;

	private constructor() {
		this.commitIntervalId = setInterval(() => {
			void this.commitBatch();
		}, this.commitIntervalMs) as unknown as number;

		this.appStateSubscription = AppState.addEventListener(
			"change",
			this.handleAppStateChange,
		);
	}

	queueChange(filePath: string, operation: GitChangeOperation): void {
		if (!filePath) {
			return;
		}

		const previous = this.queue.get(filePath);

		if (!previous) {
			this.queue.set(filePath, operation);
			return;
		}

		if (previous === "add" && operation === "modify") {
			this.queue.set(filePath, "add");
			return;
		}

		if (previous === "modify" && operation === "delete") {
			this.queue.set(filePath, "delete");
			return;
		}

		if (previous === "add" && operation === "delete") {
			this.queue.delete(filePath);
			return;
		}

		this.queue.set(filePath, operation);
	}

	async commitBatch(message?: string): Promise<void> {
		if (this.isCommitting || this.queue.size === 0) {
			return;
		}

		this.isCommitting = true;

		const snapshot: QueuedChange[] = [];
		for (const [filePath, operation] of this.queue.entries()) {
			snapshot.push({ filePath, operation });
		}
		this.queue.clear();

		try {
			const result = await commitChanges(snapshot, message);
			if (!result.success) {
				console.warn("[GitService] Commit failed:", result.error);
			}
		} catch (error) {
			console.warn("[GitService] Commit batch threw:", error);
		} finally {
			this.isCommitting = false;
		}
	}

	private handleAppStateChange = (nextState: AppStateStatus) => {
		if (nextState !== "active") {
			void this.commitBatch();
		}
	};

	dispose(): void {
		if (this.commitIntervalId !== null) {
			clearInterval(this.commitIntervalId);
			this.commitIntervalId = null;
		}
		if (this.appStateSubscription) {
			this.appStateSubscription.remove();
			this.appStateSubscription = null;
		}
	}
}
