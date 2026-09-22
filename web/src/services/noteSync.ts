import {
	parseFrontmatter,
	stringifyFrontmatter,
} from "@keeper/services/notes/frontmatter";
import type {
	PulledSyncOperation,
	QueuedSyncOperation,
} from "@keeper/services/sync/types";
import { browserStorage } from "@web/services/storage";
import {
	getSyncDeviceId,
	isBrowserSyncConfigured,
	syncFetch,
} from "@web/services/sync";
import type { BrowserNote } from "@web/ui/noteRepository";

const QUEUE_KEY = "keeper:sync:op-queue";
const SEQUENCE_KEY = "keeper:sync:next-seq";
const CURSOR_KEY = "keeper:sync:pull-cursor";
const LEGACY_BACKFILL_KEY = "keeper:sync:legacy-backfill-v1";
let syncPromise: Promise<BrowserNote[]> | null = null;
let queueMutex = Promise.resolve();

function serializeQueue<T>(work: () => Promise<T>): Promise<T> {
	const next = queueMutex.then(work, work);
	queueMutex = next.then(
		() => undefined,
		() => undefined,
	);
	return next;
}

function toIsoTime(value: number | null | undefined): string {
	return new Date(
		typeof value === "number" && Number.isFinite(value) ? value : Date.now(),
	).toISOString();
}
function bytesToBase64(bytes: Uint8Array): string {
	let value = "";
	for (let index = 0; index < bytes.length; index += 0x8000)
		value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	return btoa(value);
}
function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function asQueue(value: unknown): QueuedSyncOperation[] {
	return Array.isArray(value) ? (value as QueuedSyncOperation[]) : [];
}

async function readQueue(): Promise<QueuedSyncOperation[]> {
	const raw = await browserStorage.getState(QUEUE_KEY);
	if (!raw) return [];
	try {
		return asQueue(JSON.parse(raw));
	} catch {
		return [];
	}
}
async function writeQueue(queue: QueuedSyncOperation[]) {
	await browserStorage.setState(QUEUE_KEY, JSON.stringify(queue));
}
async function nextSequence(): Promise<number> {
	const current = Number((await browserStorage.getState(SEQUENCE_KEY)) ?? "0");
	const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
	await browserStorage.setState(SEQUENCE_KEY, String(next));
	return next;
}
async function attachmentBase64(
	note: BrowserNote,
): Promise<string | undefined> {
	if (!note.attachment) return undefined;
	const bytes = await browserStorage.readFile(note.attachment);
	return bytes ? bytesToBase64(bytes) : undefined;
}

export async function enqueueBrowserNoteSave(
	note: BrowserNote,
	isNew: boolean,
): Promise<void> {
	if (!isBrowserSyncConfigured()) return;
	await serializeQueue(async () => {
		const deviceId = await getSyncDeviceId();
		const seq = await nextSequence();
		const attachment = await attachmentBase64(note);
		const markdown = stringifyFrontmatter({
			...note,
			modified: note.modified ?? note.lastUpdated,
		});
		const operation: QueuedSyncOperation = isNew
			? {
					opId: `${deviceId}:${seq}`,
					seq,
					type: "note.create",
					noteId: note.id,
					path: `${note.id}.md`,
					title: note.title,
					markdown,
					createdAt: toIsoTime(note.createdAt ?? note.lastUpdated),
					attachmentBase64: attachment,
				}
			: {
					opId: `${deviceId}:${seq}`,
					seq,
					type: "note.update",
					noteId: note.id,
					markdown,
					updatedAt: toIsoTime(note.lastUpdated),
					attachmentBase64: attachment,
				};
		await writeQueue([...(await readQueue()), operation]);
	});
}

export async function enqueueBrowserNoteDelete(noteId: string): Promise<void> {
	if (!isBrowserSyncConfigured()) return;
	await serializeQueue(async () => {
		const deviceId = await getSyncDeviceId();
		const seq = await nextSequence();
		await writeQueue([
			...(await readQueue()),
			{
				opId: `${deviceId}:${seq}`,
				seq,
				type: "note.delete",
				noteId,
				deletedAt: new Date().toISOString(),
			},
		]);
	});
}

/** Queues retained browser notes that predate the sync queue, once per browser store. */
export async function queueMissingBrowserNotes(
	notes: BrowserNote[],
): Promise<void> {
	if (
		!isBrowserSyncConfigured() ||
		(await browserStorage.getState(LEGACY_BACKFILL_KEY))
	)
		return;
	const response = await syncFetch("/sync/note-ids");
	if (!response.ok)
		throw new Error(`Sync note inventory failed: ${response.status}`);
	const remote = new Set(
		((await response.json()) as { noteIds: string[] }).noteIds,
	);
	for (const note of notes)
		if (!remote.has(note.id)) await enqueueBrowserNoteSave(note, true);
	await browserStorage.setState(LEGACY_BACKFILL_KEY, "complete");
}

async function pushQueuedOperations(): Promise<void> {
	const queue = await readQueue();
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
	await writeQueue(
		(await readQueue()).filter((operation) => !sent.has(operation.opId)),
	);
	if ((await readQueue()).length) await pushQueuedOperations();
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
		if (path)
			await browserStorage.writeFile(
				path,
				base64ToBytes(operation.attachmentBase64),
			);
	}
	const next = remoteNote(operation);
	return [next, ...notes.filter((note) => note.id !== next.id)];
}

async function pullOperations(notes: BrowserNote[]): Promise<BrowserNote[]> {
	const deviceId = await getSyncDeviceId();
	let cursor = Math.max(
		0,
		Number((await browserStorage.getState(CURSOR_KEY)) ?? "0") || 0,
	);
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
		await browserStorage.setState(
			CURSOR_KEY,
			String(Math.max(0, result.cursor)),
		);
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
