import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { InMemoryClusterRepository } from "../clusters/inMemoryClusterRepository.js";
import {
	GitHubHeadConflictError,
	type CreateGitHubCommitInput,
} from "../github/commitClient.js";
import { InMemoryJobQueue } from "../jobs/inMemoryJobQueue.js";
import type { ServerJob } from "../jobs/types.js";
import { InMemorySyncRepository } from "../sync/inMemorySyncRepository.js";
import { createGitSyncProcessor } from "./gitWorker.js";
import { createMocClassificationProcessor } from "./mocWorker.js";

function makeJob(input: Record<string, unknown>): ServerJob {
	const now = new Date().toISOString();
	return {
		id: "job-1",
		kind: "git.sync",
		status: "running",
		createdAt: now,
		updatedAt: now,
		input,
	};
}

test("git sync worker commits canonical note state through GitHub", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "keeper-git-worker-"));
	const syncRepository = new InMemorySyncRepository();
	const commits: CreateGitHubCommitInput[] = [];
	const fileOids = new Map<string, string>();
	let head = 1;
	const client = {
		async getBranchSnapshot() {
			return { headOid: `head-${head}`, fileOids: new Map(fileOids) };
		},
		async createCommit(input: CreateGitHubCommitInput) {
			commits.push(input);
			for (const addition of input.changes.additions) {
				fileOids.set(addition.path, "9fd714ad5ec75749d31ab6526f4d94463526a737");
			}
			for (const deletion of input.changes.deletions) fileOids.delete(deletion);
			head += 1;
			return `head-${head}`;
		},
	};
	try {
		const createOperation = {
			opId: "phone:1",
			seq: 1,
			type: "note.create" as const,
			noteId: "note-1",
			path: "notes/note-1.md",
			title: "Inbox",
			markdown: "# Inbox",
			createdAt: "2026-07-11T10:00:00Z",
		};
		await syncRepository.pushOperations({ deviceId: "phone", ops: [createOperation] });
		const processor = createGitSyncProcessor({
			client,
			syncRepository,
			notesCacheDir: root,
		});
		await processor(makeJob({ operations: [createOperation] }));
		assert.deepEqual(commits[0]?.changes, {
			additions: [{ path: "notes/note-1.md", contents: "# Inbox" }],
			deletions: [],
		});
		assert.equal(await readFile(path.join(root, "notes/note-1.md"), "utf8"), "# Inbox");

		const deleteOperation = {
			opId: "phone:2",
			seq: 2,
			type: "note.delete" as const,
			noteId: "note-1",
			deletedAt: "2026-07-11T10:01:00Z",
		};
		await syncRepository.pushOperations({ deviceId: "phone", ops: [deleteOperation] });
		await processor(makeJob({ operations: [deleteOperation] }));
		assert.deepEqual(commits[1]?.changes, {
			additions: [],
			deletions: ["notes/note-1.md"],
		});
		await assert.rejects(readFile(path.join(root, "notes/note-1.md"), "utf8"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("git sync worker retries changed GitHub head", async () => {
	const syncRepository = new InMemorySyncRepository();
	const operation = {
		opId: "phone:1",
		seq: 1,
		type: "note.create" as const,
		noteId: "note-1",
		path: "note-1.md",
		title: "Inbox",
		markdown: "# Inbox",
		createdAt: "2026-07-11T10:00:00Z",
	};
	await syncRepository.pushOperations({ deviceId: "phone", ops: [operation] });
	const attemptedHeads: string[] = [];
	let headReads = 0;
	let synced = false;
	const processor = createGitSyncProcessor({
		syncRepository,
		maxAttempts: 2,
		client: {
			async getBranchSnapshot() {
				headReads += 1;
				return {
					headOid: `head-${headReads}`,
					fileOids: synced
						? new Map([["note-1.md", "9fd714ad5ec75749d31ab6526f4d94463526a737"]])
						: new Map(),
				};
			},
			async createCommit(input) {
				attemptedHeads.push(input.expectedHeadOid);
				if (attemptedHeads.length === 1) {
					throw new GitHubHeadConflictError("branch head changed");
				}
				synced = true;
				return "head-3";
			},
		},
	});

	await processor(makeJob({ operations: [operation] }));
	assert.deepEqual(attemptedHeads, ["head-1", "head-2"]);
});


test("git sync worker reconciles existing database notes", async () => {
	const syncRepository = new InMemorySyncRepository();
	await syncRepository.pushOperations({
		deviceId: "phone",
		ops: [
			{
				opId: "phone:1",
				seq: 1,
				type: "note.create",
				noteId: "existing-note",
				path: "existing.md",
				title: "Existing",
				markdown: "# Existing",
				createdAt: "2026-07-11T10:00:00Z",
			},
		],
	});
	const commits: CreateGitHubCommitInput[] = [];
	let synced = false;
	const processor = createGitSyncProcessor({
		syncRepository,
		client: {
			async getBranchSnapshot() {
				return {
					headOid: synced ? "head-2" : "head-1",
					fileOids: synced
						? new Map([["existing.md", "6df9bf71bb9ec3dfaf8b07df253ce07985ffaab3"]])
						: new Map(),
				};
			},
			async createCommit(input) {
				commits.push(input);
				synced = true;
				return "head-2";
			},
		},
	});

	await processor(makeJob({ reconcileAll: true }));
	assert.deepEqual(commits[0]?.changes, {
		additions: [{ path: "existing.md", contents: "# Existing" }],
		deletions: [],
	});
});

test("job queue runs moc classification after git sync succeeds", async () => {
	const processed: string[] = [];
	const queue = new InMemoryJobQueue({
		"git.sync": async () => {
			processed.push("git");
		},
		"moc.classify": async () => {
			processed.push("moc");
		},
	});

	await queue.enqueue("git.sync", {
		noteIds: ["note-1"],
		cursor: 1,
		operations: [],
	});
	await new Promise((resolve) => setTimeout(resolve, 0));

	const jobs = await queue.listJobs();
	assert.deepEqual(processed, ["git", "moc"]);
	assert.equal(jobs.length, 2);
	assert.deepEqual(
		jobs.map((job) => job.kind).sort(),
		["git.sync", "moc.classify"],
	);
	assert.equal(jobs.every((job) => job.status === "succeeded"), true);
});

test("moc worker imports pipeline output into cluster repository", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "keeper-moc-worker-"));
	const pipeline = path.join(root, "pipeline.py");
	const repository = new InMemoryClusterRepository();
	try {
		await mkdir(path.join(root, "notes"));
		await writeFile(
			pipeline,
			[
				"import json, pathlib, sys",
				"root = pathlib.Path(sys.argv[1])",
				"(root / '.moc_clusters.json').write_text(json.dumps({'version': 1, 'clusters': [{'id': 'cluster-1', 'name': 'Inbox', 'confidence': 0.9, 'members': [{'note_id': 'note-1', 'score': 0.8}]}]}))",
			].join("\n"),
			"utf8",
		);

		const processor = createMocClassificationProcessor({
			notesRoot: path.join(root, "notes"),
			pipelinePath: pipeline,
			clusterRepository: repository,
		});
		await processor(makeJob({}));

		const clusters = await repository.listActiveClusters();
		assert.equal(clusters.length, 1);
		assert.equal(clusters[0]?.name, "Inbox");
		assert.deepEqual(await repository.listClusterMembers("cluster-1"), [
			{ clusterId: "cluster-1", noteId: "note-1", score: 0.8 },
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
