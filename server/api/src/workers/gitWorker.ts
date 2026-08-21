import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	createOctokitGitHubCommitClient,
	GitHubHeadConflictError,
	type GitHubCommitClient,
	type GitHubFileChanges,
} from "../github/commitClient.js";
import type { ServerJob } from "../jobs/types.js";
import type { GitSyncNote, SyncOperation, SyncRepository } from "../sync/types.js";
import { withRedisGitLock } from "./redisGitLock.js";

import { createHash } from "node:crypto";
type GitWorkerConfig = {
	client: GitHubCommitClient;
	syncRepository: SyncRepository;
	notesCacheDir?: string;
	redisUrl?: string;
	maxAttempts?: number;
};

function requiredString(value: unknown, name: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required`);
	}
	return value.trim();
}

function syncOperationsFromJob(job: ServerJob): SyncOperation[] {
	const operations = job.input.operations;
	if (!Array.isArray(operations)) {
		throw new Error("git.sync job missing operations");
	}
	return operations as SyncOperation[];
}

function affectedNoteIds(operations: SyncOperation[]): string[] {
	return [...new Set(operations.map((operation) => operation.noteId))];
}

function repositoryPath(value: string): string {
	const candidate = value.trim();
	const segments = candidate.split("/");
	if (
		!candidate ||
		candidate.startsWith("/") ||
		candidate.includes("\\") ||
		segments.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error(`Invalid Git repository path: ${value}`);
	}
	return candidate;
}

function resolveNotes(
	operations: SyncOperation[],
	databaseNotes: GitSyncNote[],
): GitSyncNote[] {
	const notes = new Map(databaseNotes.map((note) => [note.id, note]));
	const latestOperations = new Map<string, SyncOperation>();
	for (const operation of operations) latestOperations.set(operation.noteId, operation);

	for (const [noteId, operation] of latestOperations) {
		if (notes.has(noteId)) continue;
		if (operation.type === "note.delete") {
			notes.set(noteId, {
				id: noteId,
				path: `${noteId}.md`,
				markdown: "",
				deletedAt: operation.deletedAt,
			});
			continue;
		}
		if (operation.type !== "note.rename") {
			throw new Error(`Git sync note missing from database: ${noteId}`);
		}
	}

	return [...notes.values()];
}

function gitBlobOid(contents: string): string {
	const bytes = Buffer.from(contents, "utf8");
	return createHash("sha1")
		.update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
		.update(bytes)
		.digest("hex");
}

function buildFileChanges(
	notes: GitSyncNote[],
	remoteFileOids: ReadonlyMap<string, string>,
): GitHubFileChanges {
	const additions = new Map<string, string>();
	const deletions = new Set<string>();

	for (const note of notes) {
		const notePath = repositoryPath(note.path);
		if (note.deletedAt) {
			if (remoteFileOids.has(notePath)) deletions.add(notePath);
			continue;
		}
		if (remoteFileOids.get(notePath) !== gitBlobOid(note.markdown)) {
			additions.set(notePath, note.markdown);
		}
	}

	return {
		additions: [...additions].map(([filePath, contents]) => ({
			path: filePath,
			contents,
		})),
		deletions: [...deletions],
	};
}

function takeFileChanges(
	changes: GitHubFileChanges,
	limit = 100,
): GitHubFileChanges {
	const additions = changes.additions.slice(0, limit);
	return {
		additions,
		deletions: changes.deletions.slice(0, limit - additions.length),
	};
}

async function updateNotesCache(
	notesCacheDir: string | undefined,
	notes: GitSyncNote[],
): Promise<void> {
	if (!notesCacheDir) return;
	for (const note of notes) {
		const filePath = path.join(notesCacheDir, repositoryPath(note.path));
		if (note.deletedAt) {
			await rm(filePath, { force: true });
			continue;
		}
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, note.markdown, "utf8");
	}
}

async function createCommitWithRetry(
	client: GitHubCommitClient,
	notes: GitSyncNote[],
	message: string,
	maxAttempts: number,
): Promise<void> {
	const attempts = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 4;
	const maxCommits = Math.ceil(notes.length / 100) + 1;

	for (let commitIndex = 0; commitIndex < maxCommits; commitIndex += 1) {
		let committed = false;
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			const snapshot = await client.getBranchSnapshot();
			const changes = buildFileChanges(notes, snapshot.fileOids);
			if (changes.additions.length === 0 && changes.deletions.length === 0) return;

			try {
				await client.createCommit({
					expectedHeadOid: snapshot.headOid,
					message,
					changes: takeFileChanges(changes),
				});
				committed = true;
				break;
			} catch (error) {
				if (!(error instanceof GitHubHeadConflictError) || attempt === attempts) {
					throw error;
				}
			}
		}
		if (!committed) throw new Error("GitHub commit retry exhausted");
	}

	throw new Error("GitHub reconciliation did not converge");
}

export function createGitSyncProcessor(config: GitWorkerConfig) {
	return async function processGitSync(job: ServerJob): Promise<void> {
		const reconcileAll = job.input.reconcileAll === true;
		const operations = reconcileAll ? [] : syncOperationsFromJob(job);
		if (!reconcileAll && operations.length === 0) return;

		await withRedisGitLock(config.redisUrl, async () => {
			const noteIds = affectedNoteIds(operations);
			const notes = reconcileAll
				? await config.syncRepository.readAllNotes()
				: resolveNotes(
						operations,
						await config.syncRepository.readNotes(noteIds),
					);
			if (notes.length === 0) return;

			const message = reconcileAll
				? `Reconcile ${notes.length} Keeper note${notes.length === 1 ? "" : "s"}`
				: `Sync ${noteIds.length} Keeper note${noteIds.length === 1 ? "" : "s"}`;
			await createCommitWithRetry(
				config.client,
				notes,
				message,
				config.maxAttempts ?? 4,
			);

			try {
				await updateNotesCache(config.notesCacheDir, notes);
			} catch (error) {
				console.warn("[GitWorker] GitHub commit succeeded but notes cache update failed", error);
			}
		});
	};
}

function tokenFromRemoteUrl(remoteUrl: string | undefined): string | undefined {
	if (!remoteUrl) return undefined;
	try {
		const url = new URL(remoteUrl);
		if (url.protocol !== "https:") return undefined;
		if (url.password) return decodeURIComponent(url.password);
		if (url.username && url.username !== "git" && url.username !== "x-access-token") {
			return decodeURIComponent(url.username);
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export function createGitSyncProcessorFromEnv(syncRepository: SyncRepository) {
	const token = requiredString(
		process.env.SERVER_GITHUB_TOKEN ||
			tokenFromRemoteUrl(process.env.SERVER_GIT_REMOTE_URL),
		"SERVER_GITHUB_TOKEN or credentialed SERVER_GIT_REMOTE_URL",
	);
	const repositoryNameWithOwner = requiredString(
		process.env.SERVER_GITHUB_REPOSITORY,
		"SERVER_GITHUB_REPOSITORY",
	);
	const [owner, repository, ...extra] = repositoryNameWithOwner.split("/");
	if (!owner || !repository || extra.length > 0) {
		throw new Error("SERVER_GITHUB_REPOSITORY must use owner/repository format");
	}
	const branch = process.env.SERVER_GIT_BRANCH ?? "main";

	return createGitSyncProcessor({
		client: createOctokitGitHubCommitClient({ token, owner, repository, branch }),
		syncRepository,
		notesCacheDir: process.env.SERVER_GIT_REPO_DIR,
		redisUrl: process.env.REDIS_URL,
		maxAttempts: Number(process.env.SERVER_GITHUB_COMMIT_ATTEMPTS ?? 4),
	});
}
