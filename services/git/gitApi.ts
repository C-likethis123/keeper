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

let octokitInstance: Octokit | null = null;

function getOctokit(): Octokit {
	if (!octokitInstance) {
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
		if (!token) {
			throw new Error("GITHUB_TOKEN is not set");
		}
		octokitInstance = new Octokit({
			auth: token,
		});
	}
	return octokitInstance;
}

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
		const localFilePath = `${NOTES_ROOT}${filePath}`;
		const file = new File(localFilePath);
		if (file.exists) {
			return await file.text();
		}
	} catch (error) {
		// File doesn't exist or can't be read
		return null;
	}
	return null;
}

async function getFileSha(filePath: string): Promise<string | null> {
	try {
		const { owner, repo } = getGitHubConfig();
		const octokit = getOctokit();
		const response = await octokit.rest.repos.getContent({
			owner,
			repo,
			path: filePath,
		});

		if (Array.isArray(response.data)) {
			return null;
		}

		if ("sha" in response.data) {
			return response.data.sha;
		}
	} catch (error: unknown) {
		if ((error as { status?: number })?.status === 404) {
			// File doesn't exist, which is fine for new files
			return null;
		}
		throw error;
	}
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
		const octokit = getOctokit();
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
					if (!sha) {
						console.warn(
							`[GitApi] File ${filePath} does not exist, skipping delete`,
						);
						continue;
					}

					const response = await octokit.rest.repos.deleteFile({
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

					// Encode content to base64
					const encodedContent =
						typeof Buffer !== "undefined"
							? Buffer.from(content, "utf-8").toString("base64")
							: btoa(unescape(encodeURIComponent(content)));

					// Get SHA if file exists (for updates)
					const sha = await getFileSha(filePath);

					const response = await octokit.rest.repos.createOrUpdateFileContents({
						owner,
						repo,
						path: filePath,
						message: commitMessage,
						content: encodedContent,
						...(sha ? { sha } : {}), // Include SHA only if file exists (for updates)
					});

					lastCommitHash = response.data.commit.sha;
				}
			} catch (error: any) {
				console.warn(
					`[GitApi] Failed to ${operation} file ${filePath}:`,
					error?.message ?? error,
				);
				// Continue with other changes even if one fails
			}
		}

		return {
			success: true,
			commitHash: lastCommitHash,
		};
	} catch (error: any) {
		console.warn("[GitApi] Failed to commit changes:", error?.message ?? error);
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
			error: localError instanceof Error ? localError.message : String(localError)
		}
	}
	return {
		success: false,
		error: "File not found"
	}
}
