import { stringifyFrontmatter } from "@/services/notes/frontmatter";
import type { Note } from "@/services/notes/types";
import {
	getSyncStateItem,
	setSyncStateItem,
} from "@/services/sync/syncStateStorage";
import type { QueuedSyncOperation } from "@/services/sync/types";
import { storageEngine } from "@/services/storage/storageEngine";

const DEVICE_ID_KEY = "keeper:sync:device-id";
const SEQ_KEY = "keeper:sync:next-seq";
const QUEUE_KEY = "keeper:sync:op-queue";
const PULL_CURSOR_KEY = "keeper:sync:pull-cursor";
const LEGACY_BACKFILL_KEY = "keeper:sync:legacy-backfill-v1";

let queueMutex = Promise.resolve();

function serializeQueue<T>(work: () => Promise<T>): Promise<T> {
	const next = queueMutex.then(work, work);
	queueMutex = next.then(
		() => undefined,
		() => undefined,
	);
	return next;
}

function createDeviceId(): string {
	return `device-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 10)}`;
}

function toIsoTime(ms: number | null | undefined): string {
	const value = typeof ms === "number" && Number.isFinite(ms) ? ms : Date.now();
	return new Date(value).toISOString();
}

function toMarkdown(note: Note): string {
	return stringifyFrontmatter({
		...note,
		modified: note.modified ?? note.lastUpdated,
	});
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return globalThis.btoa(binary);
}

async function attachmentBase64(note: Note): Promise<string | undefined> {
	if (!note.attachment) return undefined;
	const bytes = await storageEngine.readFileBytes(note.attachment);
	return bytes ? bytesToBase64(bytes) : undefined;
}

async function readQueueUnsafe(): Promise<QueuedSyncOperation[]> {
	const raw = await getSyncStateItem(QUEUE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as QueuedSyncOperation[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function writeQueueUnsafe(ops: QueuedSyncOperation[]): Promise<void> {
	await setSyncStateItem(QUEUE_KEY, JSON.stringify(ops));
}

export async function getSyncDeviceId(): Promise<string> {
	return serializeQueue(async () => {
		const existing = await getSyncStateItem(DEVICE_ID_KEY);
		if (existing) return existing;
		const next = createDeviceId();
		await setSyncStateItem(DEVICE_ID_KEY, next);
		return next;
	});
}

export async function readQueuedSyncOps(): Promise<QueuedSyncOperation[]> {
	return serializeQueue(readQueueUnsafe);
}

export async function readSyncPullCursor(): Promise<number> {
	return serializeQueue(async () => {
		const raw = await getSyncStateItem(PULL_CURSOR_KEY);
		const cursor = raw ? Number(raw) : 0;
		return Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
	});
}

export async function writeSyncPullCursor(cursor: number): Promise<void> {
	await serializeQueue(async () => {
		await setSyncStateItem(
			PULL_CURSOR_KEY,
			String(Math.max(0, Math.floor(cursor))),
		);
	});
}

export async function markSyncOpsPushed(opIds: string[]): Promise<void> {
	if (opIds.length === 0) return;
	const pushed = new Set(opIds);
	await serializeQueue(async () => {
		const queued = await readQueueUnsafe();
		await writeQueueUnsafe(queued.filter((op) => !pushed.has(op.opId)));
	});
}

async function nextSyncSequenceUnsafe(): Promise<number> {
	const raw = await getSyncStateItem(SEQ_KEY);
	const current = raw ? Number(raw) : 0;
	const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
	await setSyncStateItem(SEQ_KEY, String(next));
	return next;
}

async function appendSyncOp(
	createOperation: (
		deviceId: string,
		seq: number,
	) => Omit<QueuedSyncOperation, "opId" | "seq">,
): Promise<QueuedSyncOperation> {
	return serializeQueue(async () => {
		const deviceId =
			(await getSyncStateItem(DEVICE_ID_KEY)) ?? createDeviceId();
		await setSyncStateItem(DEVICE_ID_KEY, deviceId);
		const seq = await nextSyncSequenceUnsafe();
		const op = {
			opId: `${deviceId}:${seq}`,
			seq,
			...createOperation(deviceId, seq),
		} as QueuedSyncOperation;
		const queued = await readQueueUnsafe();
		queued.push(op);
		await writeQueueUnsafe(queued);
		return op;
	});
}

export async function enqueueNoteCreate(note: Note): Promise<QueuedSyncOperation> {
	const attachment = await attachmentBase64(note);
	return appendSyncOp(() => ({
		type: "note.create",
		noteId: note.id,
		path: `${note.id}.md`,
		title: note.title,
		markdown: toMarkdown(note),
		createdAt: toIsoTime(note.createdAt ?? note.lastUpdated),
		attachmentBase64: attachment,
	}));
}

export async function enqueueNoteUpdate(note: Note): Promise<QueuedSyncOperation> {
	const attachment = await attachmentBase64(note);
	return appendSyncOp(() => ({
		type: "note.update",
		noteId: note.id,
		markdown: toMarkdown(note),
		updatedAt: toIsoTime(note.lastUpdated),
		attachmentBase64: attachment,
	}));
}

export async function enqueueNoteDelete(noteId: string): Promise<QueuedSyncOperation> {
	return appendSyncOp(() => ({
		type: "note.delete",
		noteId,
		deletedAt: new Date().toISOString(),
	}));
}

export async function enqueueMissingLocalNotes(
	remoteNoteIds: Iterable<string>,
): Promise<number> {
	const completed = await getSyncStateItem(LEGACY_BACKFILL_KEY);
	if (completed) return 0;

	const remoteIds = new Set(remoteNoteIds);
	const queuedIds = new Set(
		(await readQueuedSyncOps()).map((operation) => operation.noteId),
	);
	let queuedCount = 0;

	for (const file of await storageEngine.listNoteFiles()) {
		if (remoteIds.has(file.id) || queuedIds.has(file.id)) continue;
		const note = await storageEngine.loadNote(file.id);
		if (!note) continue;
		await enqueueNoteCreate(note);
		queuedIds.add(note.id);
		queuedCount += 1;
	}

	await setSyncStateItem(LEGACY_BACKFILL_KEY, "complete");
	return queuedCount;
}
