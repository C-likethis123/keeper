import {
	describeSyncOperation,
	selectSyncPushBatch,
} from "@/services/sync/syncPushService";
import type { QueuedSyncOperation } from "@/services/sync/types";

const firstOperation: QueuedSyncOperation = {
	createdAt: "2026-08-22T12:00:00.000Z",
	markdown: "First body",
	noteId: "note-1",
	opId: "device:1",
	path: "note-1.md",
	seq: 1,
	title: "First",
	type: "note.create",
};

const secondOperation: QueuedSyncOperation = {
	...firstOperation,
	markdown: "Second body",
	noteId: "note-2",
	opId: "device:2",
	path: "note-2.md",
	seq: 2,
	title: "Second",
};

describe("selectSyncPushBatch", () => {
	it("stops before serialized request exceeds byte limit", () => {
		const oneOperationBytes = new TextEncoder().encode(
			JSON.stringify({ deviceId: "device", ops: [firstOperation] }),
		).byteLength;

		expect(
			selectSyncPushBatch(
				"device",
				[firstOperation, secondOperation],
				oneOperationBytes,
			),
		).toEqual([firstOperation]);
	});

	it("returns empty batch when first operation is oversized", () => {
		expect(selectSyncPushBatch("device", [firstOperation], 1)).toEqual([]);
	});

	it("describes an update without including its body", () => {
		const update: QueuedSyncOperation = {
			markdown:
				'---\ntitle: "September 19"\nid: "note-1"\n---\nPrivate note body',
			noteId: "note-1",
			opId: "device:2",
			seq: 2,
			type: "note.update",
			updatedAt: "2026-09-19T12:00:00.000Z",
		};

		expect(describeSyncOperation(update)).toEqual({
			noteId: "note-1",
			opId: "device:2",
			path: undefined,
			seq: 2,
			title: "September 19",
			type: "note.update",
		});
	});
});
