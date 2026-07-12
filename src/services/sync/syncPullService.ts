import { parseFrontmatter } from "@/services/notes/frontmatter";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import type { NoteSaveInput } from "@/services/notes/types";
import { deleteCrdtNote } from "@/services/notes/crdtNoteService";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { storageEngine } from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";
import { getSyncServerUrl } from "@/services/sync/config";
import { showSyncDebugToast } from "@/services/sync/debug";
import { pullSyncOperations } from "@/services/sync/remoteSyncClient";
import {
	getSyncDeviceId,
	readSyncPullCursor,
	writeSyncPullCursor,
} from "@/services/sync/syncOpQueue";
import type { PulledSyncOperation } from "@/services/sync/types";

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

async function applyRemoteOperation(operation: PulledSyncOperation): Promise<void> {
	switch (operation.type) {
		case "note.create":
		case "note.update":
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
): Promise<void> {
	if (operations.length === 0) return;

	for (const operation of operations) {
		await applyRemoteOperation(operation);
	}
	invalidateNoteQueryCache();
	useStorageStore.getState().bumpContentVersion();
}

export function scheduleSyncPull(delayMs = 0): void {
	if (!getSyncServerUrl()) return;
	clearRetryTimer();
	retryTimer = setTimeout(() => {
		retryTimer = null;
		void pullPendingSyncOps();
	}, Math.max(0, delayMs));
}

export async function pullPendingSyncOps(): Promise<void> {
	if (pullPromise) return pullPromise;

	pullPromise = (async () => {
		if (!getSyncServerUrl()) return;

		try {
			const deviceId = await getSyncDeviceId();
			let cursor = await readSyncPullCursor();

			for (;;) {
				const previousCursor = cursor;
				const result = await pullSyncOperations(deviceId, cursor);
				await applyRemoteOperations(result.ops);
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
			scheduleSyncPull(retryMs);
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
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
