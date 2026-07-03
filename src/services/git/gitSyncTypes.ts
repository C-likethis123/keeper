export type FlushReason = "note-exit" | "delete" | "app-background";

export interface GitFlushResult {
	success: boolean;
	didCommit: boolean;
	didPush: boolean;
	error?: string;
	didRecover?: boolean;
}

export interface FlushOptions {
	reason: FlushReason;
	timeoutMs?: number;
	message?: string;
}
