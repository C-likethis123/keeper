import AsyncStorage from "@react-native-async-storage/async-storage";
import { stringifyFrontmatter } from "@/services/notes/frontmatter";
import type { Note } from "@/services/notes/types";
import type { QueuedSyncOperation } from "@/services/sync/types";

const DEVICE_ID_KEY = "keeper:sync:device-id";
const SEQ_KEY = "keeper:sync:next-seq";
const QUEUE_KEY = "keeper:sync:op-queue";
const PULL_CURSOR_KEY = "keeper:sync:pull-cursor";

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

async function readQueueUnsafe(): Promise<QueuedSyncOperation[]> {
	const raw = await AsyncStorage.getItem(QUEUE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as QueuedSyncOperation[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function writeQueueUnsafe(ops: QueuedSyncOperation[]): Promise<void> {
	await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}

export async function getSyncDeviceId(): Promise<string> {
	return serializeQueue(async () => {
		const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
		if (existing) return existing;
		const next = createDeviceId();
		await AsyncStorage.setItem(DEVICE_ID_KEY, next);
		return next;
	});
}

export async function readQueuedSyncOps(): Promise<QueuedSyncOperation[]> {
	return serializeQueue(readQueueUnsafe);
}

export async function readSyncPullCursor(): Promise<number> {
	return serializeQueue(async () => {
		const raw = await AsyncStorage.getItem(PULL_CURSOR_KEY);
		const cursor = raw ? Number(raw) : 0;
		return Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
	});
}

export async function writeSyncPullCursor(cursor: number): Promise<void> {
	await serializeQueue(async () => {
		await AsyncStorage.setItem(
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
	const raw = await AsyncStorage.getItem(SEQ_KEY);
	const current = raw ? Number(raw) : 0;
	const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
	await AsyncStorage.setItem(SEQ_KEY, String(next));
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
			(await AsyncStorage.getItem(DEVICE_ID_KEY)) ?? createDeviceId();
		await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
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
	return appendSyncOp(() => ({
		type: "note.create",
		noteId: note.id,
		path: `${note.id}.md`,
		title: note.title,
		markdown: toMarkdown(note),
		createdAt: toIsoTime(note.createdAt ?? note.lastUpdated),
	}));
}

export async function enqueueNoteUpdate(note: Note): Promise<QueuedSyncOperation> {
	return appendSyncOp(() => ({
		type: "note.update",
		noteId: note.id,
		markdown: toMarkdown(note),
		updatedAt: toIsoTime(note.lastUpdated),
	}));
}

export async function enqueueNoteDelete(noteId: string): Promise<QueuedSyncOperation> {
	return appendSyncOp(() => ({
		type: "note.delete",
		noteId,
		deletedAt: new Date().toISOString(),
	}));
}
