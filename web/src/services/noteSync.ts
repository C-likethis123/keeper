import { parseFrontmatter } from "@keeper/services/notes/frontmatter";
import { isServerSyncConfigured } from "@keeper/services/sync/config";
import {
	listSyncNoteIds,
	pullSyncOperations,
	pushSyncOperations,
} from "@keeper/services/sync/remoteSyncClient";
import {
	enqueueMissingLocalNotes,
	enqueueNoteCreate,
	enqueueNoteDelete,
	enqueueNoteUpdate,
	getSyncDeviceId,
	markSyncOpsPushed,
	readQueuedSyncOps,
	readSyncPullCursor,
	writeSyncPullCursor,
} from "@keeper/services/sync/syncOpQueue";
import type { PulledSyncOperation } from "@keeper/services/sync/types";
import { writeAttachmentBytesToNotes } from "@web/adapters/browser/attachmentStorage";
import {
	deleteBrowserNote,
	loadBrowserNotes,
	type BrowserNote,
	upsertBrowserNote,
} from "@web/ui/noteRepository";

const POLL_INTERVAL_MS = 30_000;
let syncPromise: Promise<BrowserNote[]> | null = null;

function base64ToBytes(value: string): Uint8Array {
	const binary = globalThis.atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function enqueueBrowserNoteSave(
	note: BrowserNote,
	isNew: boolean,
): Promise<void> {
	if (!isServerSyncConfigured()) return;
	await (isNew ? enqueueNoteCreate(note) : enqueueNoteUpdate(note));
}

export async function enqueueBrowserNoteDelete(noteId: string): Promise<void> {
	if (!isServerSyncConfigured()) return;
	await enqueueNoteDelete(noteId);
}

async function queueMissingBrowserNotes(): Promise<void> {
	const remote = await listSyncNoteIds();
	await enqueueMissingLocalNotes(remote.noteIds);
}

async function pushQueuedOperations(): Promise<Set<string>> {
	const deviceId = await getSyncDeviceId();
	const pushedNoteIds = new Set<string>();
	for (;;) {
		const batch = (await readQueuedSyncOps()).slice(0, 100);
		if (batch.length === 0) return pushedNoteIds;
		const result = await pushSyncOperations(deviceId, batch);
		const completed = [
			...result.accepted,
			...(result.duplicates ?? []),
		];
		if (completed.length === 0) {
			throw new Error("Sync push made no progress");
		}
		const completedIds = new Set(completed);
		for (const operation of batch) {
			if (completedIds.has(operation.opId)) {
				pushedNoteIds.add(operation.noteId);
			}
		}
		await markSyncOpsPushed(completed);
	}
}

function remoteNote(
	operation: Extract<
		PulledSyncOperation,
		{ type: "note.create" | "note.update" }
	>,
): BrowserNote {
	const parsed = parseFrontmatter(operation.markdown);
	const timestamp = Date.parse(
		operation.type === "note.create"
			? operation.createdAt
			: operation.updatedAt,
	);
	const updatedAt = Number.isFinite(timestamp) ? timestamp : Date.now();
	return {
		id: operation.noteId,
		title:
			parsed.title || (operation.type === "note.create" ? operation.title : ""),
		content: parsed.content,
		isPinned: parsed.isPinned,
		noteType: parsed.noteType,
		status: parsed.status ?? null,
		createdAt:
			parsed.createdAt ?? (operation.type === "note.create" ? updatedAt : null),
		completedAt: parsed.completedAt ?? null,
		attachment: parsed.attachment ?? null,
		attachedVideo: parsed.attachedVideo ?? null,
		resourceUrl: parsed.resourceUrl ?? null,
		documentPositions: parsed.documentPositions ?? null,
		lastUpdated: updatedAt,
		modified: parsed.modified ?? updatedAt,
	};
}

async function hasPendingLocalChange(noteId: string): Promise<boolean> {
	return (await readQueuedSyncOps()).some(
		(operation) => operation.noteId === noteId,
	);
}

async function applyRemoteOperation(
	operation: PulledSyncOperation,
	protectedNoteIds: ReadonlySet<string>,
): Promise<void> {
	// Queue remains authoritative until push succeeds. Its later operation will
	// replace skipped remote state during next successful server round trip.
	if (
		protectedNoteIds.has(operation.noteId) ||
		(await hasPendingLocalChange(operation.noteId))
	)
		return;
	if (operation.type === "note.delete") {
		await deleteBrowserNote(operation.noteId);
		return;
	}
	if (operation.type === "note.rename") {
		const existing = (await loadBrowserNotes()).find(
			(note) => note.id === operation.noteId,
		);
		if (!existing) return;
		const parsedTimestamp = Date.parse(operation.updatedAt);
		const updatedAt = Number.isFinite(parsedTimestamp)
			? parsedTimestamp
			: Date.now();
		await upsertBrowserNote({
			...existing,
			title: operation.title,
			lastUpdated: updatedAt,
			modified: updatedAt,
		});
		return;
	}
	if (operation.attachmentBase64) {
		const path = parseFrontmatter(operation.markdown).attachment;
		if (path) {
			await writeAttachmentBytesToNotes(
				path,
				base64ToBytes(operation.attachmentBase64),
			);
		}
	}
	await upsertBrowserNote(remoteNote(operation));
}

async function pullOperations(protectedNoteIds: ReadonlySet<string>): Promise<void> {
	const deviceId = await getSyncDeviceId();
	let cursor = await readSyncPullCursor();
	for (;;) {
		const result = await pullSyncOperations(deviceId, cursor);
		for (const operation of result.ops) {
			await applyRemoteOperation(operation, protectedNoteIds);
		}
		// Never persist cursor for page only partially applied.
		await writeSyncPullCursor(result.cursor);
		if (result.ops.length === 0 || result.cursor === cursor) return;
		cursor = result.cursor;
	}
}

export async function syncBrowserNotes(options: {
	backfill?: boolean;
} = {}): Promise<BrowserNote[]> {
	if (!isServerSyncConfigured()) return loadBrowserNotes();
	if (syncPromise) return syncPromise;
	syncPromise = (async () => {
		if (options.backfill) await queueMissingBrowserNotes();
		const pushedNoteIds = await pushQueuedOperations();
		await pullOperations(pushedNoteIds);
		return loadBrowserNotes();
	})();
	try {
		return await syncPromise;
	} finally {
		syncPromise = null;
	}
}

export function startBrowserSync(options: {
	onError(error: unknown): void;
	onNotes(notes: BrowserNote[]): void;
}): () => void {
	if (!isServerSyncConfigured()) return () => undefined;
	const sync = (backfill = false) => {
		void syncBrowserNotes({ backfill })
			.then(options.onNotes)
			.catch(options.onError);
	};
	const online = () => sync();
	sync(true);
	window.addEventListener("online", online);
	const poll = window.setInterval(online, POLL_INTERVAL_MS);
	return () => {
		window.removeEventListener("online", online);
		window.clearInterval(poll);
	};
}
