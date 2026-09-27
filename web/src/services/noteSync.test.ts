import "fake-indexeddb/auto";
import { storageEngine } from "@/services/storage/storageEngine";
import { configureSyncServerUrl } from "@keeper/services/sync/config";
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
import {
	loadBrowserNotes,
	persistBrowserNotes,
} from "@web/ui/noteRepository";
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
		configureSyncServerUrl("https://sync.example");
		await storageEngine.initialize();
		await storageEngine.resetAllData();
	});

	afterEach(() => {
		configureSyncServerUrl(null);
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

		await syncBrowserNotes();

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

		await expect(syncBrowserNotes()).rejects.toThrow("Sync push failed with 503");
		expect(await readQueuedSyncOps()).toHaveLength(1);
	});

	it("advances the pull cursor and persists it across reloads", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pullResponse(12)));

		await syncBrowserNotes();
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

		const result = await syncBrowserNotes();
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

		const result = await syncBrowserNotes();

		expect(result[0]?.attachment).toBe(path);
		expect(await storageEngine.readFileBytes(path)).toEqual(
			new Uint8Array([9, 8, 7]),
		);
		expect(revokeObjectURL).toHaveBeenCalledWith(replacedUrl);
		expect(await resolveAttachmentUri(path)).not.toBe(replacedUrl);
		releaseAttachmentUri(path);
	});

	it("collapses concurrent sync calls into one run", async () => {
		let resolvePull: ((response: Response) => void) | undefined;
		const fetchMock = vi.fn().mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolvePull = resolve;
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const first = syncBrowserNotes();
		const second = syncBrowserNotes();
		await vi.waitFor(() => expect(resolvePull).toBeDefined());
		resolvePull?.(pullResponse());
		await Promise.all([first, second]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not advance cursor when applying a pull page fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						cursor: 7,
						ops: [
							{
								serverId: 7,
								deviceId: "desktop",
								opId: "desktop:7",
								seq: 7,
								type: "note.create",
								noteId: "broken-attachment",
								path: "broken-attachment.md",
								title: "Broken",
								markdown:
									'---\ntitle: "Broken"\nid: "broken-attachment"\ntype: "note"\nattachment: "_attachments/broken.pdf"\n---\nBody',
								createdAt: "2026-01-01T00:00:00.000Z",
								attachmentBase64: "%%%not-base64%%%",
							},
						],
					}),
					{ status: 200 },
				),
			),
		);

		await expect(syncBrowserNotes()).rejects.toThrow();
		expect(await readSyncPullCursor()).toBe(0);
	});

	it("applies remote update, rename, and delete canonically", async () => {
		await persistBrowserNotes([note]);
		const updatedMarkdown =
			'---\ntitle: "Updated"\nid: "note-1"\ntype: "note"\n---\nRemote update';
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						cursor: 2,
						ops: [
							{
								serverId: 1,
								deviceId: "desktop",
								opId: "desktop:1",
								seq: 1,
								type: "note.update",
								noteId: "note-1",
								markdown: updatedMarkdown,
								updatedAt: "2026-01-01T00:00:00.000Z",
							},
							{
								serverId: 2,
								deviceId: "desktop",
								opId: "desktop:2",
								seq: 2,
								type: "note.rename",
								noteId: "note-1",
								path: "note-1.md",
								title: "Renamed",
								updatedAt: "2026-01-01T00:01:00.000Z",
							},
						],
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						cursor: 3,
						ops: [
							{
								serverId: 3,
								deviceId: "desktop",
								opId: "desktop:3",
								seq: 3,
								type: "note.delete",
								noteId: "note-1",
								deletedAt: "2026-01-01T00:02:00.000Z",
							},
						],
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(pullResponse(3));
		vi.stubGlobal("fetch", fetchMock);

		await syncBrowserNotes();

		expect(await loadBrowserNotes()).toEqual([]);
		expect(await readSyncPullCursor()).toBe(3);
	});

	it("does not apply remote delete over newer queued local edit", async () => {
		await persistBrowserNotes([note]);
		let resolvePull: ((response: Response) => void) | undefined;
		const fetchMock = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<Response>((resolve) => {
						resolvePull = resolve;
					}),
			)
			.mockResolvedValue(pullResponse(1));
		vi.stubGlobal("fetch", fetchMock);

		const syncing = syncBrowserNotes();
		await vi.waitFor(() => expect(resolvePull).toBeDefined());
		const localEdit = { ...note, content: "Newer local body", lastUpdated: 2000 };
		await persistBrowserNotes([localEdit]);
		await enqueueBrowserNoteSave(localEdit, false);
		resolvePull?.(
			new Response(
				JSON.stringify({
					cursor: 1,
					ops: [
						{
							serverId: 1,
							deviceId: "desktop",
							opId: "desktop:1",
							seq: 1,
							type: "note.delete",
							noteId: "note-1",
							deletedAt: "2026-01-01T00:00:00.000Z",
						},
					],
				}),
				{ status: 200 },
			),
		);
		const result = await syncing;

		expect(result).toEqual([
			expect.objectContaining({ id: "note-1", content: "Newer local body" }),
		]);
		expect(await readQueuedSyncOps()).toHaveLength(1);
	});

	it("does not apply older remote delete after newer local edit is pushed", async () => {
		await persistBrowserNotes([note]);
		await enqueueBrowserNoteSave(note, false);
		const queued = await readQueuedSyncOps();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ accepted: [queued[0]?.opId], duplicates: [], cursor: 2 }),
					{ status: 202 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						cursor: 2,
						ops: [
							{
								serverId: 1,
								deviceId: "desktop",
								opId: "desktop:1",
								seq: 1,
								type: "note.delete",
								noteId: "note-1",
								deletedAt: "2025-01-01T00:00:00.000Z",
							},
						],
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(pullResponse(2));
		vi.stubGlobal("fetch", fetchMock);

		const result = await syncBrowserNotes();

		expect(result).toEqual([expect.objectContaining({ id: "note-1" })]);
		expect(await readQueuedSyncOps()).toEqual([]);
	});
});
