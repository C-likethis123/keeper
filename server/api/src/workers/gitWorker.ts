import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ServerJob } from "../jobs/types.js";
import type { SyncOperation } from "../sync/types.js";
import { withRedisGitLock } from "./redisGitLock.js";

const execFileAsync = promisify(execFile);

type GitWorkerConfig = {
	remoteUrl: string;
	repoDir: string;
	branch?: string;
	redisUrl?: string;
	userName?: string;
	userEmail?: string;
};

function requiredString(value: unknown, name: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function syncOperationsFromJob(job: ServerJob): SyncOperation[] {
	const operations = job.input.operations;
	if (!Array.isArray(operations)) {
		throw new Error("git.sync job missing operations");
	}
	return operations as SyncOperation[];
}

function notePath(operation: SyncOperation): string {
	if ("path" in operation && operation.path.trim().length > 0) {
		return operation.path;
	}
	return `${operation.noteId}.md`;
}

async function runGit(repoDir: string, args: string[]): Promise<string> {
	const result = await execFileAsync("git", args, {
		cwd: repoDir,
		maxBuffer: 10 * 1024 * 1024,
	});
	return `${result.stdout}${result.stderr}`;
}

async function ensureRepo(config: GitWorkerConfig): Promise<void> {
	await mkdir(path.dirname(config.repoDir), { recursive: true });
	try {
		await runGit(config.repoDir, ["rev-parse", "--is-inside-work-tree"]);
	} catch {
		await rm(config.repoDir, { recursive: true, force: true });
		await execFileAsync("git", [
			"clone",
			"--branch",
			config.branch ?? "main",
			config.remoteUrl,
			config.repoDir,
		]);
	}

	await runGit(config.repoDir, [
		"config",
		"user.name",
		config.userName ?? "Keeper Server",
	]);
	await runGit(config.repoDir, [
		"config",
		"user.email",
		config.userEmail ?? "keeper-server@example.com",
	]);
}

async function writeOperations(repoDir: string, operations: SyncOperation[]) {
	for (const operation of operations) {
		const relativePath = notePath(operation);
		const filePath = path.join(repoDir, relativePath);
		if (operation.type === "note.delete") {
			await rm(filePath, { force: true });
			continue;
		}
		if (operation.type === "note.rename") {
			continue;
		}
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, operation.markdown, "utf8");
	}
}

async function commitAndPush(repoDir: string, message: string): Promise<void> {
	await runGit(repoDir, ["add", "-A"]);
	const status = await runGit(repoDir, ["status", "--porcelain"]);
	if (status.trim().length === 0) return;
	await runGit(repoDir, ["commit", "-m", message]);
	await runGit(repoDir, ["push"]);
}

export function createGitSyncProcessor(config: GitWorkerConfig) {
	return async function processGitSync(job: ServerJob): Promise<void> {
		const operations = syncOperationsFromJob(job);
		if (operations.length === 0) return;

		await withRedisGitLock(config.redisUrl, async () => {
			await ensureRepo(config);
			await runGit(config.repoDir, ["pull", "--ff-only"]);
			await writeOperations(config.repoDir, operations);
			await commitAndPush(
				config.repoDir,
				`Sync ${operations.length} Keeper operation${operations.length === 1 ? "" : "s"}`,
			);
		});
	};
}

export function createGitSyncProcessorFromEnv() {
	const remoteUrl = requiredString(process.env.SERVER_GIT_REMOTE_URL, "SERVER_GIT_REMOTE_URL");
	const repoDir = requiredString(process.env.SERVER_GIT_REPO_DIR, "SERVER_GIT_REPO_DIR");
	return createGitSyncProcessor({
		remoteUrl,
		repoDir,
		branch: process.env.SERVER_GIT_BRANCH ?? "main",
		redisUrl: process.env.REDIS_URL,
		userName: process.env.SERVER_GIT_USER_NAME,
		userEmail: process.env.SERVER_GIT_USER_EMAIL,
	});
}
