import {
	parseFrontmatter,
} from "@keeper/services/notes/frontmatter";
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
import type {
	PulledSyncOperation,
} from "@keeper/services/sync/types";
import { writeAttachmentBytesToNotes } from "@web/adapters/browser/attachmentStorage";
import {
	isBrowserSyncConfigured,
	syncFetch,
} from "@web/services/sync";
import type { BrowserNote } from "@web/ui/noteRepository";

let syncPromise: Promise<BrowserNote[]> | null = null;
function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
export async function enqueueBrowserNoteSave(
	note: BrowserNote,
	isNew: boolean,
): Promise<void> {
	if (!isBrowserSyncConfigured()) return;
	await (isNew ? enqueueNoteCreate(note) : enqueueNoteUpdate(note));
}

export async function enqueueBrowserNoteDelete(noteId: string): Promise<void> {
	if (!isBrowserSyncConfigured()) return;
	await enqueueNoteDelete(noteId);
}

/** Queues retained browser notes that predate the sync queue, once per browser store. */
export async function queueMissingBrowserNotes(
	_notes: BrowserNote[],
): Promise<void> {
	if (!isBrowserSyncConfigured()) return;
	const response = await syncFetch("/sync/note-ids");
	if (!response.ok)
		throw new Error(`Sync note inventory failed: ${response.status}`);
	const remote = new Set(
		((await response.json()) as { noteIds: string[] }).noteIds,
	);
	await enqueueMissingLocalNotes(remote);
}

async function pushQueuedOperations(): Promise<void> {
	const queue = await readQueuedSyncOps();
	if (!queue.length) return;
	const deviceId = await getSyncDeviceId();
	const batch = queue.slice(0, 100);
	const response = await syncFetch("/sync/push", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ deviceId, ops: batch }),
	});
	if (!response.ok) throw new Error(`Sync push failed: ${response.status}`);
	const result = (await response.json()) as {
		accepted: string[];
		duplicates?: string[];
	};
	const sent = new Set([...result.accepted, ...(result.duplicates ?? [])]);
	await markSyncOpsPushed([...sent]);
	if ((await readQueuedSyncOps()).length) await pushQueuedOperations();
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

async function applyRemoteOperation(
	notes: BrowserNote[],
	operation: PulledSyncOperation,
): Promise<BrowserNote[]> {
	if (operation.type === "note.delete")
		return notes.filter((note) => note.id !== operation.noteId);
	if (operation.type === "note.rename")
		return notes.map((note) =>
			note.id === operation.noteId
				? {
						...note,
						title: operation.title,
						lastUpdated: Date.parse(operation.updatedAt) || Date.now(),
						modified: Date.parse(operation.updatedAt) || Date.now(),
					}
				: note,
		);
	if (operation.attachmentBase64) {
		const path = parseFrontmatter(operation.markdown).attachment;
		if (path) {
			await writeAttachmentBytesToNotes(
				path,
				base64ToBytes(operation.attachmentBase64),
			);
		}
	}
	const next = remoteNote(operation);
	return [next, ...notes.filter((note) => note.id !== next.id)];
}

async function pullOperations(notes: BrowserNote[]): Promise<BrowserNote[]> {
	const deviceId = await getSyncDeviceId();
	let cursor = await readSyncPullCursor();
	let current = notes;
	for (;;) {
		const response = await syncFetch(
			`/sync/pull?${new URLSearchParams({ deviceId, cursor: String(cursor), limit: "100" })}`,
		);
		if (!response.ok) throw new Error(`Sync pull failed: ${response.status}`);
		const result = (await response.json()) as {
			ops: PulledSyncOperation[];
			cursor: number;
		};
		for (const operation of result.ops)
			current = await applyRemoteOperation(current, operation);
		await writeSyncPullCursor(result.cursor);
		if (!result.ops.length || result.cursor === cursor) return current;
		cursor = result.cursor;
	}
}

/** Push local editor changes, then apply remote operations using source sync protocol. */
export async function syncBrowserNotes(
	notes: BrowserNote[],
): Promise<BrowserNote[]> {
	if (!isBrowserSyncConfigured()) return notes;
	if (syncPromise) return syncPromise;
	syncPromise = (async () => {
		await pushQueuedOperations();
		return pullOperations(notes);
	})();
	try {
		return await syncPromise;
	} finally {
		syncPromise = null;
	}
}
