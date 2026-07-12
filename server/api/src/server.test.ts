import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryClusterRepository } from "./clusters/inMemoryClusterRepository.js";
import { InMemoryJobQueue } from "./jobs/inMemoryJobQueue.js";
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

test("sync pull returns remote operations after cursor", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });

	await server.inject({
		method: "POST",
		url: "/sync/push",
		payload: {
			deviceId: "phone",
			ops: [
				{
					opId: "phone:1",
					seq: 1,
					type: "note.create",
					noteId: "note-1",
					path: "notes/note-1.md",
					title: "Inbox",
					markdown: "# Inbox",
					createdAt: "2026-07-11T10:00:00Z",
				},
				{
					opId: "phone:2",
					seq: 2,
					type: "note.delete",
					noteId: "note-1",
					deletedAt: "2026-07-11T10:03:00Z",
				},
			],
		},
	});

	const response = await server.inject({
		method: "GET",
		url: "/sync/pull?deviceId=macbook&cursor=0",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), {
		ops: [
			{
				serverId: 1,
				deviceId: "phone",
				opId: "phone:1",
				seq: 1,
				type: "note.create",
				noteId: "note-1",
				path: "notes/note-1.md",
				title: "Inbox",
				markdown: "# Inbox",
				createdAt: "2026-07-11T10:00:00Z",
			},
			{
				serverId: 2,
				deviceId: "phone",
				opId: "phone:2",
				seq: 2,
				type: "note.delete",
				noteId: "note-1",
				deletedAt: "2026-07-11T10:03:00Z",
			},
		],
		cursor: 2,
	});

	await server.close();
});

test("sync pull advances cursor across same-device operations", async () => {
	const repository = new InMemorySyncRepository();
	const server = createServer({ syncRepository: repository });

	await server.inject({
		method: "POST",
		url: "/sync/push",
		payload: {
			deviceId: "phone",
			ops: [
				{
					opId: "phone:1",
					seq: 1,
					type: "note.create",
					noteId: "note-1",
					path: "notes/note-1.md",
					title: "Inbox",
					markdown: "# Inbox",
					createdAt: "2026-07-11T10:00:00Z",
				},
			],
		},
	});

	const response = await server.inject({
		method: "GET",
		url: "/sync/pull?deviceId=phone&cursor=0",
	});

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json(), { ops: [], cursor: 1 });

	await server.close();
});

test("accepted sync push enqueues git job with accepted operations", async () => {
	const repository = new InMemorySyncRepository();
	const jobQueue = new InMemoryJobQueue();
	const server = createServer({ syncRepository: repository, jobQueue });

	const pushResponse = await server.inject({
		method: "POST",
		url: "/sync/push",
		payload: {
			deviceId: "phone",
			ops: [
				{
					opId: "phone:1",
					seq: 1,
					type: "note.create",
					noteId: "note-1",
					path: "notes/note-1.md",
					title: "Inbox",
					markdown: "# Inbox",
					createdAt: "2026-07-11T10:00:00Z",
				},
			],
		},
	});
	assert.equal(pushResponse.statusCode, 202);

	const jobsResponse = await server.inject({
		method: "GET",
		url: "/jobs",
	});

	assert.equal(jobsResponse.statusCode, 200);
	const jobs = jobsResponse.json();
	assert.equal(jobs.length, 1);
	assert.equal(jobs[0].kind, "git.sync");
	assert.equal(jobs[0].status, "queued");
	assert.deepEqual(jobs[0].input.opIds, ["phone:1"]);

	const jobResponse = await server.inject({
		method: "GET",
		url: `/jobs/${jobs[0].id}`,
	});
	assert.equal(jobResponse.statusCode, 200);
	assert.equal(jobResponse.json().id, jobs[0].id);

	await server.close();
});

test("cluster API serves suggestions and persists feedback", async () => {
	const repository = new InMemorySyncRepository();
	const clusterRepository = new InMemoryClusterRepository();
	await clusterRepository.importClusters({
		version: 1,
		clusters: [
			{
				id: "cluster-1",
				name: "Inbox",
				confidence: 0.9,
				members: [{ note_id: "note-1", score: 0.8 }],
			},
		],
	});
	const server = createServer({
		syncRepository: repository,
		clusterRepository,
	});

	const activeResponse = await server.inject({
		method: "GET",
		url: "/clusters/active",
	});
	assert.equal(activeResponse.statusCode, 200);
	assert.equal(activeResponse.json()[0].name, "Inbox");

	const membersResponse = await server.inject({
		method: "GET",
		url: "/clusters/cluster-1/members",
	});
	assert.deepEqual(membersResponse.json(), [
		{ clusterId: "cluster-1", noteId: "note-1", score: 0.8 },
	]);

	const acceptResponse = await server.inject({
		method: "POST",
		url: "/clusters/cluster-1/accept",
		payload: { acceptedNoteId: "moc-1" },
	});
	assert.equal(acceptResponse.statusCode, 204);

	const acceptedResponse = await server.inject({
		method: "GET",
		url: "/clusters/accepted",
	});
	assert.equal(acceptedResponse.json()[0].acceptedNoteId, "moc-1");

	const feedbackResponse = await server.inject({
		method: "GET",
		url: "/clusters/feedback",
	});
	assert.equal(feedbackResponse.statusCode, 200);
	assert.equal(feedbackResponse.json()[0].eventType, "accept");

	await server.close();
});

test("sync push upserts update for missing note", async () => {
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

	assert.equal(response.statusCode, 202);
	assert.equal(repository.notes.get("missing")?.markdown, "# Missing");

	await server.close();
});

test("sync push accepts delete for missing note", async () => {
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
					type: "note.delete",
					noteId: "missing",
					deletedAt: "2026-07-11T10:00:00Z",
				},
			],
		},
	});

	assert.equal(response.statusCode, 202);
	assert.deepEqual(response.json(), {
		accepted: ["macbook:1"],
		duplicates: [],
		cursor: 1,
	});

	await server.close();
});

test("sync push accepts rename for missing note", async () => {
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
					type: "note.rename",
					noteId: "missing",
					path: "notes/missing.md",
					title: "Missing",
					updatedAt: "2026-07-11T10:00:00Z",
				},
			],
		},
	});

	assert.equal(response.statusCode, 202);
	assert.deepEqual(response.json(), {
		accepted: ["macbook:1"],
		duplicates: [],
		cursor: 1,
	});

	await server.close();
});
