import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserStorage } from "@web/services/storage";
import { enqueueBrowserNoteSave, syncBrowserNotes } from "./noteSync";

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

describe("browser note sync", () => {
	beforeEach(async () => {
		vi.stubEnv("VITE_SYNC_SERVER_URL", "https://sync.example");
		await Promise.all(
			[
				"sync:device-id",
				"keeper:sync:device-id",
				"keeper:sync:next-seq",
				"keeper:sync:op-queue",
				"keeper:sync:pull-cursor",
			].map((key) => browserStorage.setState(key, "")),
		);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});
	it("queues and pushes a canonical note operation before pulling", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ accepted: ["device-test:1"] }), {
					status: 202,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ops: [], cursor: 0 }), { status: 200 }),
			);
		vi.stubGlobal("fetch", fetchMock);
		await browserStorage.setState("keeper:sync:device-id", "device-test");
		await enqueueBrowserNoteSave(note, true);
		await syncBrowserNotes([note]);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sync.example/sync/push");
		const pushed = JSON.parse(
			(fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
		);
		expect(pushed.ops[0]).toMatchObject({
			type: "note.create",
			noteId: note.id,
			title: note.title,
		});
		expect(fetchMock.mock.calls[1]?.[0]).toContain("/sync/pull?");
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
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ops: [], cursor: 1 }), { status: 200 }),
			);
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
});
