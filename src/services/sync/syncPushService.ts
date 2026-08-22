import {
	getSyncServerUrl,
	isServerSyncConfigured,
} from "@/services/sync/config";
import { showSyncDebugToast } from "@/services/sync/debug";
import { pushSyncOperations } from "@/services/sync/remoteSyncClient";
import {
	getSyncDeviceId,
	markSyncOpsPushed,
	readQueuedSyncOps,
} from "@/services/sync/syncOpQueue";
import { isSyncRequestError } from "@/services/sync/syncRequestError";

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 60_000;
const MAX_PUSH_BODY_BYTES = 15 * 1024 * 1024;
const MAX_PUSH_OPERATIONS = 100;

let retryMs = BASE_RETRY_MS;
let pushPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function jsonByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function selectSyncPushBatch(
	deviceId: string,
	queued: Awaited<ReturnType<typeof readQueuedSyncOps>>,
	maxBodyBytes = MAX_PUSH_BODY_BYTES,
): Awaited<ReturnType<typeof readQueuedSyncOps>> {
	const batch: Awaited<ReturnType<typeof readQueuedSyncOps>> = [];
	for (const operation of queued.slice(0, MAX_PUSH_OPERATIONS)) {
		const candidate = [...batch, operation];
		if (jsonByteLength({ deviceId, ops: candidate }) > maxBodyBytes) {
			break;
		}
		batch.push(operation);
	}
	return batch;
}

function clearRetryTimer(): void {
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
}

export function scheduleSyncPush(delayMs = 0): void {
	const serverUrl = getSyncServerUrl();
	if (!isServerSyncConfigured() || !serverUrl) {
		showSyncDebugToast("Sync skipped: no server URL", 8000);
		return;
	}
	clearRetryTimer();
	retryTimer = setTimeout(
		() => {
			retryTimer = null;
			void pushPendingSyncOps();
		},
		Math.max(0, delayMs),
	);
}

export async function pushPendingSyncOps(): Promise<void> {
	if (pushPromise) return pushPromise;

	pushPromise = (async () => {
		if (!isServerSyncConfigured()) return;

		const queued = await readQueuedSyncOps();
		if (queued.length === 0) {
			retryMs = BASE_RETRY_MS;
			showSyncDebugToast("Sync skipped: queue empty");
			return;
		}

		try {
			const deviceId = await getSyncDeviceId();
			const batch = selectSyncPushBatch(deviceId, queued);
			if (batch.length === 0) {
				showSyncDebugToast(
					"Sync paused: first queued change exceeds server upload limit",
					10000,
				);
				return;
			}
			const result = await pushSyncOperations(deviceId, batch);
			await markSyncOpsPushed([
				...result.accepted,
				...(result.duplicates ?? []),
			]);
			retryMs = BASE_RETRY_MS;

			const remaining = await readQueuedSyncOps();
			if (remaining.length > 0) {
				scheduleSyncPush(0);
			}
		} catch (error) {
			console.warn("[SyncPushService] Push failed:", error);
			showSyncDebugToast(
				`Sync push failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
				10000,
			);
			if (isSyncRequestError(error) && error.status === 413) {
				showSyncDebugToast(
					"Sync paused: server rejected oversized upload",
					10000,
				);
				return;
			}
			if (isSyncRequestError(error) && error.status === 429) {
				scheduleSyncPush(error.retryAfterMs ?? retryMs);
				return;
			}
			scheduleSyncPush(retryMs);
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
		}
	})();

	try {
		await pushPromise;
	} finally {
		pushPromise = null;
	}
}

export function startSyncPushService(): void {
	scheduleSyncPush(0);
}
