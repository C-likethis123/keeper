import { keeperApiFetch } from "@/services/sync/keeperApiFetch";
import { createSyncRequestError } from "@/services/sync/syncRequestError";
import type {
	QueuedSyncOperation,
	SyncNoteIdsResponse,
	SyncPullResponse,
	SyncPushResponse,
} from "@/services/sync/types";

export async function pushSyncOperations(
	deviceId: string,
	ops: QueuedSyncOperation[],
): Promise<SyncPushResponse> {
	const response = await keeperApiFetch("/sync/push", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ deviceId, ops }),
	});

	if (!response.ok) {
		throw await createSyncRequestError(response, "Sync push");
	}

	return (await response.json()) as SyncPushResponse;
}

export async function pullSyncOperations(
	deviceId: string,
	cursor: number,
	limit = 100,
): Promise<SyncPullResponse> {
	const params = new URLSearchParams({
		deviceId,
		cursor: String(Math.max(0, cursor)),
		limit: String(limit),
	});
	const response = await keeperApiFetch(`/sync/pull?${params.toString()}`);

	if (!response.ok) {
		throw await createSyncRequestError(response, "Sync pull");
	}

	return (await response.json()) as SyncPullResponse;
}

export async function listSyncNoteIds(): Promise<SyncNoteIdsResponse> {
	const response = await keeperApiFetch("/sync/note-ids");
	if (!response.ok) {
		throw await createSyncRequestError(response, "Sync note inventory");
	}

	return (await response.json()) as SyncNoteIdsResponse;
}
