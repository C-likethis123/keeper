import { graphql } from "@octokit/graphql";

export type GitHubFileAddition = {
	path: string;
	contents: string;
};

export type GitHubFileChanges = {
	additions: GitHubFileAddition[];
	deletions: string[];
};

export type GitHubBranchSnapshot = {
	headOid: string;
	fileOids: ReadonlyMap<string, string>;
};

export type CreateGitHubCommitInput = {
	expectedHeadOid: string;
	message: string;
	changes: GitHubFileChanges;
};

export type GitHubCommitClient = {
	getBranchSnapshot(): Promise<GitHubBranchSnapshot>;
	createCommit(input: CreateGitHubCommitInput): Promise<string>;
};

export class GitHubHeadConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubHeadConflictError";
	}
}

type GitHubCommitClientConfig = {
	token: string;
	owner: string;
	repository: string;
	branch: string;
};

function isHeadConflict(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /expected.*head|branch.*(?:head|point)|pull and try again/i.test(message);
}

export function createOctokitGitHubCommitClient(
	config: GitHubCommitClientConfig,
): GitHubCommitClient {
	const request = graphql.defaults({
		headers: { authorization: `bearer ${config.token}` },
	});
	const repositoryApiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`;
	const restHeaders = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${config.token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};

	async function getJson<T>(url: string): Promise<T> {
		const response = await fetch(url, { headers: restHeaders });
		if (!response.ok) {
			const body = await response.text();
			throw new Error(`GitHub request failed (${response.status}): ${body}`);
		}
		return (await response.json()) as T;
	}

	return {
		async getBranchSnapshot(): Promise<GitHubBranchSnapshot> {
			const commit = await getJson<{
				sha: string;
				commit: { tree: { sha: string } };
			}>(`${repositoryApiUrl}/commits/${encodeURIComponent(config.branch)}`);
			const tree = await getJson<{
				truncated: boolean;
				tree: Array<{ path: string; type: string; sha: string }>;
			}>(`${repositoryApiUrl}/git/trees/${commit.commit.tree.sha}?recursive=1`);
			if (tree.truncated) {
				throw new Error("GitHub repository tree is too large to reconcile safely");
			}
			return {
				headOid: commit.sha,
				fileOids: new Map(
					tree.tree
						.filter((entry) => entry.type === "blob")
						.map((entry) => [entry.path, entry.sha]),
				),
			};
		},

		async createCommit(input: CreateGitHubCommitInput): Promise<string> {
			try {
				const result = await request<{
					createCommitOnBranch: { commit: { oid: string } } | null;
				}>(
					`mutation KeeperCreateCommit($input: CreateCommitOnBranchInput!) {
						createCommitOnBranch(input: $input) { commit { oid } }
					}`,
					{
						input: {
							branch: {
								repositoryNameWithOwner: `${config.owner}/${config.repository}`,
								branchName: config.branch,
							},
							expectedHeadOid: input.expectedHeadOid,
							message: { headline: input.message },
							fileChanges: {
								additions: input.changes.additions.map((file) => ({
									path: file.path,
									contents: Buffer.from(file.contents, "utf8").toString("base64"),
								})),
								deletions: input.changes.deletions.map((path) => ({ path })),
							},
						},
					},
				);
				const oid = result.createCommitOnBranch?.commit.oid;
				if (!oid) throw new Error("GitHub commit mutation returned no commit");
				return oid;
			} catch (error) {
				if (isHeadConflict(error)) {
					throw new GitHubHeadConflictError(
						error instanceof Error ? error.message : String(error),
					);
				}
				throw error;
			}
		},
	};
}
