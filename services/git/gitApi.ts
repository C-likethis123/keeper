import { NOTES_ROOT } from "@/services/notes/Notes";
import { Octokit } from "@octokit/rest";
import { File } from "expo-file-system";

export type GitChangeOperation = "add" | "modify" | "delete";

export interface GitChange {
	filePath: string;
	operation: GitChangeOperation;
}

export interface CommitResponse {
	success: boolean;
	commitHash?: string;
	error?: string;
}

export interface GetFileResponse {
	success: boolean;
	content?: string;
	error?: string;
}

const OctokitClient: Octokit = new Octokit({
	auth: process.env.EXPO_PUBLIC_GITHUB_TOKEN,
});

function getGitHubConfig() {
	const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
	const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;

	if (!owner || !repo) {
		throw new Error(
			"EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO must be set",
		);
	}

	return { owner, repo };
}

async function readLocalFileContent(filePath: string): Promise<string | null> {
	try {
		const file = new File(NOTES_ROOT, filePath);
		if (file.exists) {
			return await file.text();
		}
	} catch (error) {
		// File doesn't exist or can't be read
		return null;
	}
	return null;
}

async function getFileSha(filePath: string): Promise<string> {
	const { owner, repo } = getGitHubConfig();
	const response = await OctokitClient.rest.repos.getContent({
		owner,
		repo,
		path: filePath,
	});

	if (Array.isArray(response.data)) {
		throw new Error(`Path is a directory, not a file: ${filePath}`);
	}
	if (!("sha" in response.data)) {
		throw new Error(`No sha in response for ${filePath}`);
	}
	return response.data.sha;
}

export async function commitChanges(
	changes: GitChange[],
	message?: string,
): Promise<CommitResponse> {
	if (changes.length === 0) {
		return { success: true };
	}

	try {
		const { owner, repo } = getGitHubConfig();
		const commitMessage = message || `Update ${changes.length} file(s)`;

		let lastCommitHash: string | undefined;

		// Process changes sequentially
		// Note: Each operation creates a separate commit. To batch into a single commit,
		// we would need to use the Git Data API which is more complex.
		for (const change of changes) {
			const { filePath, operation } = change;

			try {
				if (operation === "delete") {
					const sha = await getFileSha(filePath);

					const response = await OctokitClient.rest.repos.deleteFile({
						owner,
						repo,
						path: filePath,
						message: commitMessage,
						sha,
					});

					lastCommitHash = response.data.commit.sha;
				} else if (operation === "add" || operation === "modify") {
					const content = await readLocalFileContent(filePath);
					if (content === null) {
						console.warn(
							`[GitApi] Could not read local file ${filePath}, skipping ${operation}`,
						);
						continue;
					}

					const encodedContent = Buffer.from(content, "utf-8").toString(
						"base64",
					);

					const sha =
						operation === "modify" ? await getFileSha(filePath) : undefined;

					const response =
						await OctokitClient.rest.repos.createOrUpdateFileContents({
							owner,
							repo,
							path: filePath,
							message: commitMessage,
							content: encodedContent,
							...(sha !== undefined ? { sha } : {}),
						});

					lastCommitHash = response.data.commit.sha;
				}
			} catch (error: unknown) {
				const msg = error instanceof Error ? error.message : String(error);
				console.warn(`[GitApi] Failed to ${operation} file ${filePath}:`, msg);
				// Continue with other changes even if one fails
			}
		}

		return {
			success: true,
			commitHash: lastCommitHash,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn("[GitApi] Failed to commit changes:", message);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function getFile(filePath: string): Promise<GetFileResponse> {
	try {
		const file = new File(NOTES_ROOT, filePath);
		if (file.exists) {
			const content = await file.text();
			return {
				success: true,
				content,
			};
		}
	} catch (localError) {
		if (
			localError instanceof Error &&
			!localError.message.includes("not found") &&
			!localError.message.includes("ENOENT")
		) {
			console.warn(
				"[GitApi] Error reading local file, falling back to GitHub API:",
				localError.message,
			);
		}
		return {
			success: false,
			error:
				localError instanceof Error ? localError.message : String(localError),
		};
	}
	return {
		success: false,
		error: "File not found",
	};
}
