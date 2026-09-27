import "fake-indexeddb/auto";
import { storageEngine } from "@/services/storage/storageEngine";
import {
	getSyncDeviceId,
	readQueuedSyncOps,
	readSyncPullCursor,
} from "@keeper/services/sync/syncOpQueue";
import { setSyncStateItem } from "@/services/sync/syncStateStorage";
import {
	releaseAttachmentUri,
	resolveAttachmentUri,
} from "@web/adapters/browser/attachmentStorage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	enqueueBrowserNoteDelete,
	enqueueBrowserNoteSave,
	syncBrowserNotes,
} from "./noteSync";

const note = {
	id: "note-1",
	title: "Plan",
	content: "Local body",
	noteType: "note" as const,
	isPinned: false,
	lastUpdated: 1000,
	modified: 1000,
	status: null,
	createdAt: 1000,
	completedAt: null,
	attachment: null,
	attachedVideo: null,
	resourceUrl: null,
	documentPositions: null,
};

function pullResponse(cursor = 0) {
	return new Response(JSON.stringify({ ops: [], cursor }), { status: 200 });
}

describe("browser note sync", () => {
	beforeEach(async () => {
		vi.stubEnv("VITE_SYNC_SERVER_URL", "https://sync.example");
		await storageEngine.initialize();
		await storageEngine.resetAllData();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("persists the device ID across service reloads", async () => {
		const deviceId = await getSyncDeviceId();
		expect(await getSyncDeviceId()).toBe(deviceId);
	});

	it("persists queued operations across reloads in sequence order", async () => {
		await enqueueBrowserNoteSave(note, true);
		await enqueueBrowserNoteSave({ ...note, content: "Updated" }, false);
		await enqueueBrowserNoteDelete(note.id);
		const queued = await readQueuedSyncOps();
		expect(queued.map((operation) => operation.type)).toEqual([
			"note.create",
			"note.update",
			"note.delete",
		]);
		expect(queued.map((operation) => operation.seq)).toEqual([1, 2, 3]);
	});

	it("pushes canonical operations and removes accepted and duplicate entries", async () => {
		await setSyncStateItem("keeper:sync:device-id", "device-test");
		await enqueueBrowserNoteSave(note, true);
		await enqueueBrowserNoteSave({ ...note, content: "Updated" }, false);
		const queued = await readQueuedSyncOps();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						accepted: [queued[0]?.opId],
						duplicates: [queued[1]?.opId],
					}),
					{ status: 202 },
				),
			)
			.mockResolvedValueOnce(pullResponse());
		vi.stubGlobal("fetch", fetchMock);

		await syncBrowserNotes([note]);

		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://sync.example/sync/push",
		);
		const pushed = JSON.parse(
			(fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
		);
		expect(pushed.ops.map((operation: { type: string }) => operation.type)).toEqual(
			["note.create", "note.update"],
		);
		expect(await readQueuedSyncOps()).toEqual([]);
	});

	it("retains queued operations after a failed push", async () => {
		await enqueueBrowserNoteSave(note, true);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
		);

		await expect(syncBrowserNotes([note])).rejects.toThrow("Sync push failed: 503");
		expect(await readQueuedSyncOps()).toHaveLength(1);
	});

	it("advances the pull cursor and persists it across reloads", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pullResponse(12)));

		await syncBrowserNotes([note]);
		expect(await readSyncPullCursor()).toBe(12);
		expect(await readSyncPullCursor()).toBe(12);
	});

	it("fails safely when persisted queue and cursor state are malformed", async () => {
		await setSyncStateItem(
			"keeper:sync:op-queue",
			JSON.stringify([{ broken: true }]),
		);
		await setSyncStateItem("keeper:sync:pull-cursor", "not-a-number");

		expect(await readQueuedSyncOps()).toEqual([]);
		expect(await readSyncPullCursor()).toBe(0);
	});

	it("applies pulled remote note updates", async () => {
		const remoteMarkdown =
			'---\ntitle: "Remote"\npinned: true\nid: "remote-1"\ntype: "note"\n---\nRemote body';
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						ops: [
							{
								serverId: 1,
								deviceId: "desktop",
								opId: "desktop:1",
								seq: 1,
								type: "note.create",
								noteId: "remote-1",
								path: "remote-1.md",
								title: "Remote",
								markdown: remoteMarkdown,
								createdAt: "2026-01-01T00:00:00.000Z",
							},
						],
						cursor: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(pullResponse(1));
		vi.stubGlobal("fetch", fetchMock);

		const result = await syncBrowserNotes([note]);
		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "remote-1",
					title: "Remote",
					content: "Remote body",
					isPinned: true,
				}),
			]),
		);
	});

	it("persists sync-downloaded attachment bytes in canonical storage", async () => {
		const path = "_attachments/remote-1_agenda.pdf";
		const revokeObjectURL = vi.fn();
		let objectUrl = 0;
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => `blob:sync-attachment-${++objectUrl}`),
			revokeObjectURL,
		});
		await storageEngine.writeFileBytes(path, new Uint8Array([1]));
		const replacedUrl = await resolveAttachmentUri(path);
		const remoteMarkdown = `---\ntitle: "Remote document"\nid: "remote-1"\ntype: "note"\nattachment: "${path}"\n---\nRemote body`;
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						ops: [
							{
								serverId: 1,
								deviceId: "desktop",
								opId: "desktop:1",
								seq: 1,
								type: "note.create",
								noteId: "remote-1",
								path: "remote-1.md",
								title: "Remote document",
								markdown: remoteMarkdown,
								createdAt: "2026-01-01T00:00:00.000Z",
								attachmentBase64: btoa(String.fromCharCode(9, 8, 7)),
							},
						],
						cursor: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(pullResponse(1));
		vi.stubGlobal("fetch", fetchMock);

		const result = await syncBrowserNotes([note]);

		expect(result[0]?.attachment).toBe(path);
		expect(await storageEngine.readFileBytes(path)).toEqual(
			new Uint8Array([9, 8, 7]),
		);
		expect(revokeObjectURL).toHaveBeenCalledWith(replacedUrl);
		expect(await resolveAttachmentUri(path)).not.toBe(replacedUrl);
		releaseAttachmentUri(path);
	});
});
