import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "./server.js";
import { InMemorySyncRepository } from "./sync/inMemorySyncRepository.js";

test("health route returns ok", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });

	const response = await server.inject({
		method: "GET",
		url: "/health",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), { ok: true });

	await server.close();
});

test("sync push persists create, update, rename, and delete operations", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });

	const response = await server.inject({
		method: "POST",
		url: "/sync/push",
		payload: {
			deviceId: "macbook",
			ops: [
				{
					opId: "macbook:1",
					seq: 1,
					type: "note.create",
					noteId: "note-1",
					path: "notes/note-1.md",
					title: "Inbox",
					markdown: "# Inbox",
					createdAt: "2026-07-11T10:00:00Z",
				},
				{
					opId: "macbook:2",
					seq: 2,
					type: "note.update",
					noteId: "note-1",
					markdown: "# Inbox\n\nBody",
					updatedAt: "2026-07-11T10:01:00Z",
				},
				{
					opId: "macbook:3",
					seq: 3,
					type: "note.rename",
					noteId: "note-1",
					path: "notes/renamed.md",
					title: "Renamed",
					updatedAt: "2026-07-11T10:02:00Z",
				},
				{
					opId: "macbook:4",
					seq: 4,
					type: "note.delete",
					noteId: "note-1",
					deletedAt: "2026-07-11T10:03:00Z",
				},
			],
		},
	});

	assert.equal(response.statusCode, 202);
	assert.deepEqual(response.json(), {
		accepted: ["macbook:1", "macbook:2", "macbook:3", "macbook:4"],
		duplicates: [],
		cursor: 4,
	});
	assert.equal(repository.notes.get("note-1")?.path, "notes/renamed.md");
	assert.equal(repository.notes.get("note-1")?.deletedAt, "2026-07-11T10:03:00Z");

	await server.close();
});

test("sync push treats repeated op id as duplicate", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });
	const payload = {
		deviceId: "macbook",
		ops: [
			{
				opId: "macbook:1",
				seq: 1,
				type: "note.create",
				noteId: "note-1",
				path: "notes/note-1.md",
				title: "Inbox",
				markdown: "# Inbox",
				createdAt: "2026-07-11T10:00:00Z",
			},
		],
	};

	await server.inject({ method: "POST", url: "/sync/push", payload });
	const response = await server.inject({
		method: "POST",
		url: "/sync/push",
		payload,
	});

	assert.equal(response.statusCode, 202);
	assert.deepEqual(response.json(), {
		accepted: [],
		duplicates: ["macbook:1"],
		cursor: 1,
	});

	await server.close();
});

test("sync push rejects update for missing note", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });

	const response = await server.inject({
		method: "POST",
		url: "/sync/push",
		payload: {
			deviceId: "macbook",
			ops: [
				{
					opId: "macbook:1",
					seq: 1,
					type: "note.update",
					noteId: "missing",
					markdown: "# Missing",
					updatedAt: "2026-07-11T10:00:00Z",
				},
			],
		},
	});

	assert.equal(response.statusCode, 409);
	assert.equal(response.json().error, "sync_conflict");

	await server.close();
});
