import { execFile } from "node:child_process";
import { mkdir, opendir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
	SeedNoteInput,
	SeedNotesResult,
	SyncRepository,
} from "../sync/types.js";
import { withRedisGitLock } from "../workers/redisGitLock.js";

const execFileAsync = promisify(execFile);
const GITHUB_SEED_DEVICE_ID = "github-seed";

export type GitHubSeedRequest = {
	repository: string;
	ref: string;
	sha: string;
	proceedIfDbHasData: boolean;
};

export type GitHubSeedResult = SeedNotesResult & {
	sha: string;
};

export type GitHubSeedService = {
	seed(input: GitHubSeedRequest): Promise<GitHubSeedResult>;
};

export type GitHubSeedConfig = {
	remoteUrl: string;
	repoDir: string;
	branch?: string;
	redisUrl?: string;
};

export function createGitHubSeedService(
	config: GitHubSeedConfig,
	syncRepository: SyncRepository,
): GitHubSeedService {
	return {
		async seed(input: GitHubSeedRequest): Promise<GitHubSeedResult> {
			return withRedisGitLock(config.redisUrl, async () => {
				await ensureRepo(config);
				await checkoutSeedRef(config, input.sha || input.ref);
				const notes = await readSeedNotes(config.repoDir, input.sha);
				const result = await syncRepository.seedNotes({
					deviceId: GITHUB_SEED_DEVICE_ID,
					notes,
				});
				return { ...result, sha: input.sha };
			});
		},
	};
}

export function createGitHubSeedServiceFromEnv(
	syncRepository: SyncRepository,
): GitHubSeedService {
	const remoteUrl = requiredString("SERVER_GIT_REMOTE_URL");
	const repoDir = requiredString("SERVER_GIT_REPO_DIR");
	return createGitHubSeedService(
		{
			remoteUrl,
			repoDir,
			branch: process.env.SERVER_GIT_BRANCH ?? "main",
			redisUrl: process.env.REDIS_URL,
		},
		syncRepository,
	);
}

async function ensureRepo(config: GitHubSeedConfig): Promise<void> {
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
	await runGit(config.repoDir, ["fetch", "origin", config.branch ?? "main"]);
}

async function checkoutSeedRef(
	config: GitHubSeedConfig,
	ref: string,
): Promise<void> {
	await runGit(config.repoDir, ["checkout", "--force", ref]);
}

async function readSeedNotes(
	repoDir: string,
	sourceSha: string,
): Promise<SeedNoteInput[]> {
	const timestamp = new Date().toISOString();
	const markdownPaths = await listMarkdownFiles(repoDir);
	const notes = await Promise.all(
		markdownPaths.map(async (relativePath) => {
			const markdown = await readFile(path.join(repoDir, relativePath), "utf8");
			const noteId = noteIdFromPath(relativePath);
			return {
				noteId,
				path: relativePath,
				title: extractTitle(markdown) || noteId,
				markdown,
				sourceSha,
				timestamp,
			};
		}),
	);
	return notes.sort((a, b) => a.path.localeCompare(b.path));
}

async function listMarkdownFiles(repoDir: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
		for await (const entry of await opendir(dir)) {
			const fullPath = path.join(dir, entry.name);
			const relativePath = path.relative(repoDir, fullPath).replaceAll(path.sep, "/");
			if (entry.isDirectory()) {
				if (entry.name === ".git" || relativePath.startsWith("logseq/bak/")) {
					continue;
				}
				await walk(fullPath);
				continue;
			}
			if (entry.isFile() && relativePath.endsWith(".md")) {
				files.push(relativePath);
			}
		}
	}

	await walk(repoDir);
	return files.filter((file) => !file.startsWith("logseq/bak/"));
}

async function runGit(cwd: string, args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout;
}

function noteIdFromPath(markdownPath: string): string {
	return path.basename(markdownPath, ".md");
}

function extractTitle(markdown: string): string {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
	if (frontmatter) {
		for (const rawLine of frontmatter[1].split(/\r?\n/)) {
			const separator = rawLine.indexOf(":");
			if (separator < 0) continue;
			const key = rawLine.slice(0, separator).trim();
			if (key !== "title") continue;
			const value = rawLine.slice(separator + 1).trim();
			if (value.startsWith('"') && value.endsWith('"')) {
				try {
					return JSON.parse(value) as string;
				} catch {
					return value.slice(1, -1);
				}
			}
			return value;
		}
	}
	return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? "";
}

function requiredString(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}
