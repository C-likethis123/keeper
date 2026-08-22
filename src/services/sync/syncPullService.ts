import { deleteCrdtNote } from "@/services/notes/crdtNoteService";
import { parseFrontmatter } from "@/services/notes/frontmatter";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import type { NoteSaveInput } from "@/services/notes/types";
import { storageEngine } from "@/services/storage/storageEngine";
import { isServerSyncConfigured } from "@/services/sync/config";
import { showSyncDebugToast } from "@/services/sync/debug";
import { pullSyncOperations } from "@/services/sync/remoteSyncClient";
import {
	getSyncDeviceId,
	readSyncPullCursor,
	writeSyncPullCursor,
} from "@/services/sync/syncOpQueue";
import { isSyncRequestError } from "@/services/sync/syncRequestError";
import type { PulledSyncOperation } from "@/services/sync/types";
import { useStorageStore } from "@/stores/storageStore";

function base64ToBytes(value: string): Uint8Array {
	const binary = globalThis.atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 60_000;

let retryMs = BASE_RETRY_MS;
let pullPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer(): void {
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
}

function parseRemoteMarkdown(
	operation: Extract<
		PulledSyncOperation,
		{ type: "note.create" | "note.update" }
	>,
): NoteSaveInput {
	const parsed = parseFrontmatter(operation.markdown);
	const updatedAt =
		operation.type === "note.create"
			? Date.parse(operation.createdAt)
			: Date.parse(operation.updatedAt);
	const createdAt =
		operation.type === "note.create"
			? Date.parse(operation.createdAt)
			: parsed.createdAt;

	return {
		id: operation.noteId,
		title: parsed.title || ("title" in operation ? operation.title : ""),
		content: parsed.content,
		isPinned: parsed.isPinned,
		noteType: parsed.noteType,
		status: parsed.status ?? null,
		createdAt: Number.isFinite(createdAt) ? createdAt : null,
		completedAt: parsed.completedAt ?? null,
		attachment: parsed.attachment ?? null,
		attachedVideo: parsed.attachedVideo ?? null,
		resourceUrl: parsed.resourceUrl ?? null,
		documentPositions: parsed.documentPositions ?? null,
		modified: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
	};
}

async function upsertRemoteNote(note: NoteSaveInput): Promise<void> {
	const saved = await storageEngine.saveNote(note);
	await NotesIndexService.upsertNote({
		noteId: saved.id,
		title: saved.title,
		summary: extractSummary(saved.content),
		isPinned: saved.isPinned,
		updatedAt: saved.lastUpdated,
		noteType: saved.noteType,
		status: saved.status ?? null,
	});
}

async function restoreRemoteAttachment(
	operation: Extract<
		PulledSyncOperation,
		{ type: "note.create" | "note.update" }
	>,
): Promise<void> {
	if (!operation.attachmentBase64) return;
	const parsed = parseFrontmatter(operation.markdown);
	if (!parsed.attachment) return;
	await storageEngine.writeFileBytes(
		parsed.attachment,
		base64ToBytes(operation.attachmentBase64),
	);
}

async function applyRemoteOperation(
	operation: PulledSyncOperation,
): Promise<void> {
	switch (operation.type) {
		case "note.create":
		case "note.update":
			await restoreRemoteAttachment(operation);
			await upsertRemoteNote(parseRemoteMarkdown(operation));
			return;
		case "note.rename": {
			const existing = await storageEngine.loadNote(operation.noteId);
			if (!existing) return;
			await upsertRemoteNote({
				...existing,
				title: operation.title,
				modified: Date.parse(operation.updatedAt),
			});
			return;
		}
		case "note.delete":
			await deleteCrdtNote(operation.noteId);
			await storageEngine.deleteNote(operation.noteId);
			await NotesIndexService.deleteNote(operation.noteId);
			return;
	}
}

async function applyRemoteOperations(
	operations: PulledSyncOperation[],
): Promise<boolean> {
	if (operations.length === 0) return false;

	for (const operation of operations) {
		await applyRemoteOperation(operation);
	}
	return true;
}

export function scheduleSyncPull(delayMs = 0): void {
	if (!isServerSyncConfigured()) return;
	clearRetryTimer();
	retryTimer = setTimeout(
		() => {
			retryTimer = null;
			void pullPendingSyncOps();
		},
		Math.max(0, delayMs),
	);
}

export async function pullPendingSyncOps(): Promise<void> {
	if (pullPromise) return pullPromise;

	pullPromise = (async () => {
		if (!isServerSyncConfigured()) return;

		let didApplyOperations = false;
		try {
			const deviceId = await getSyncDeviceId();
			let cursor = await readSyncPullCursor();

			for (;;) {
				const previousCursor = cursor;
				const result = await pullSyncOperations(deviceId, cursor);
				didApplyOperations =
					(await applyRemoteOperations(result.ops)) || didApplyOperations;
				await writeSyncPullCursor(result.cursor);
				cursor = result.cursor;
				if (result.ops.length === 0 || result.cursor === previousCursor) {
					break;
				}
			}
			retryMs = BASE_RETRY_MS;
		} catch (error) {
			console.warn("[SyncPullService] Pull failed:", error);
			showSyncDebugToast(
				`Sync pull failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
				10000,
			);
			if (isSyncRequestError(error) && error.status === 429) {
				scheduleSyncPull(error.retryAfterMs ?? retryMs);
				return;
			}
			scheduleSyncPull(retryMs);
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
		} finally {
			if (didApplyOperations) {
				invalidateNoteQueryCache();
				useStorageStore.getState().bumpContentVersion();
			}
		}
	})();

	try {
		await pullPromise;
	} finally {
		pullPromise = null;
	}
}

export function startSyncPullService(): void {
	scheduleSyncPull(0);
}
