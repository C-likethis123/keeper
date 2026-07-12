import { getSyncServerUrl } from "@/services/sync/config";
import type {
	QueuedSyncOperation,
	SyncPullResponse,
	SyncPushResponse,
} from "@/services/sync/types";

export async function pushSyncOperations(
	deviceId: string,
	ops: QueuedSyncOperation[],
): Promise<SyncPushResponse> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) {
		throw new Error("Sync server URL is not configured");
	}

	const response = await fetch(`${serverUrl}/sync/push`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ deviceId, ops }),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Sync push failed with ${response.status}${body ? `: ${body}` : ""}`,
		);
	}

	return (await response.json()) as SyncPushResponse;
}

export async function pullSyncOperations(
	deviceId: string,
	cursor: number,
	limit = 100,
): Promise<SyncPullResponse> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) {
		throw new Error("Sync server URL is not configured");
	}

	const params = new URLSearchParams({
		deviceId,
		cursor: String(Math.max(0, cursor)),
		limit: String(limit),
	});
	const response = await fetch(`${serverUrl}/sync/pull?${params.toString()}`);

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Sync pull failed with ${response.status}${body ? `: ${body}` : ""}`,
		);
	}

	return (await response.json()) as SyncPullResponse;
}
