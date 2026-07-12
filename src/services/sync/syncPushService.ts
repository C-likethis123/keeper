import { getSyncServerUrl } from "@/services/sync/config";
import { showSyncDebugToast } from "@/services/sync/debug";
import { pushSyncOperations } from "@/services/sync/remoteSyncClient";
import {
	getSyncDeviceId,
	markSyncOpsPushed,
	readQueuedSyncOps,
} from "@/services/sync/syncOpQueue";

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 60_000;

let retryMs = BASE_RETRY_MS;
let pushPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer(): void {
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
}

export function scheduleSyncPush(delayMs = 0): void {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) {
		showSyncDebugToast("Sync skipped: no server URL", 8000);
		return;
	}
	clearRetryTimer();
	retryTimer = setTimeout(() => {
		retryTimer = null;
		void pushPendingSyncOps();
	}, Math.max(0, delayMs));
}

export async function pushPendingSyncOps(): Promise<void> {
	if (pushPromise) return pushPromise;

	pushPromise = (async () => {
		if (!getSyncServerUrl()) return;

		const queued = await readQueuedSyncOps();
		if (queued.length === 0) {
			retryMs = BASE_RETRY_MS;
			showSyncDebugToast("Sync skipped: queue empty");
			return;
		}

		try {
			const deviceId = await getSyncDeviceId();
			const batch = queued.slice(0, 100);
			showSyncDebugToast(`Sync pushing ${batch.length}`);
			const result = await pushSyncOperations(deviceId, batch);
			await markSyncOpsPushed([
				...result.accepted,
				...(result.duplicates ?? []),
			]);
			retryMs = BASE_RETRY_MS;
			showSyncDebugToast(`Sync pushed ${result.accepted.length}`);

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
