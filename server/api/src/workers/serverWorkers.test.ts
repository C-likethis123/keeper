import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { InMemoryClusterRepository } from "../clusters/inMemoryClusterRepository.js";
import { InMemoryJobQueue } from "../jobs/inMemoryJobQueue.js";
import type { ServerJob } from "../jobs/types.js";
import { createGitSyncProcessor } from "./gitWorker.js";
import { createMocClassificationProcessor } from "./mocWorker.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]) {
	await execFileAsync("git", args, { cwd });
}

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

test("git sync worker commits creates, updates, and deletes to remote", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "keeper-git-worker-"));
	const remote = path.join(root, "remote.git");
	const seed = path.join(root, "seed");
	const clone = path.join(root, "clone");
	try {
		await git(root, ["init", "--bare", remote]);
		await git(root, ["clone", remote, seed]);
		await git(seed, ["checkout", "-b", "main"]);
		await git(seed, ["config", "user.email", "keeper@example.com"]);
		await git(seed, ["config", "user.name", "Keeper Server"]);
		await writeFile(path.join(seed, "README.md"), "seed\n", "utf8");
		await git(seed, ["add", "."]);
		await git(seed, ["commit", "-m", "seed"]);
		await git(seed, ["push", "-u", "origin", "main"]);

		const processor = createGitSyncProcessor({
			remoteUrl: remote,
			repoDir: clone,
			branch: "main",
		});
		await processor(
			makeJob({
				operations: [
					{
						opId: "phone:1",
						seq: 1,
						type: "note.create",
						noteId: "note-1",
						path: "note-1.md",
						title: "Inbox",
						markdown: "# Inbox",
						createdAt: "2026-07-11T10:00:00Z",
					},
				],
			}),
		);
		assert.equal(await readFile(path.join(clone, "note-1.md"), "utf8"), "# Inbox");

		await processor(
			makeJob({
				operations: [
					{
						opId: "phone:2",
						seq: 2,
						type: "note.delete",
						noteId: "note-1",
						deletedAt: "2026-07-11T10:01:00Z",
					},
				],
			}),
		);

		const verify = path.join(root, "verify");
		await git(root, ["clone", "--branch", "main", remote, verify]);
		await assert.rejects(readFile(path.join(verify, "note-1.md"), "utf8"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
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
