import { NOTES_ROOT } from "@/services/notes/Notes";
import { Directory, File } from "expo-file-system";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { createExpoFileSystemAdapter } from "./expoFileSystemAdapter";
import "./patch-FileReader";

const fs = createExpoFileSystemAdapter();

export interface GitHubConfig {
	owner: string;
	repo: string;
	token: string;
}

function assertGitHubConfig(): GitHubConfig {
	const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
	const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;
	const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
	if (!owner || !repo) {
		throw new Error(
			"GitHub owner and repo not configured. Set EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO",
		);
	}
	if (!token) {
		throw new Error(
			"GitHub token not configured. Set EXPO_PUBLIC_GITHUB_TOKEN",
		);
	}
	return { owner, repo, token };
}

export interface InitializationResult {
	success: boolean;
	wasCloned: boolean;
	error?: string;
}

export class GitInitializationService {
	static readonly instance = new GitInitializationService();
	private readonly config = assertGitHubConfig();

	private constructor() {}
	async initialize(): Promise<InitializationResult> {
		const initStart = performance.now();
		console.log("[GitInitializationService] Starting initialization...");
		try {
			console.log(
				"[GitInitializationService] Checking if local repository exists and is valid...",
			);
			const repoValidation = await this.validateRepository();
			console.log(
				`[GitInitializationService] Repository validation: ${repoValidation.isValid ? "VALID" : "INVALID"}`,
			);
			if (!repoValidation.isValid && repoValidation.reason) {
				console.log(
					`[GitInitializationService] Validation reason: ${repoValidation.reason}`,
				);
			}

			if (!repoValidation.isValid) {
				if (repoValidation.exists) {
					console.log(
						"[GitInitializationService] Invalid repository detected, please clear your cache manually and try again",
					);
					return {
						success: false,
						wasCloned: true,
						error:
							"Invalid repository detected, please clear your cache manually and try again",
					};
				}

				console.log("[GitInitializationService] Starting fresh clone...");
				const cloned = await this.cloneRepository();
				if (!cloned) {
					const error =
						"Failed to clone repository. Check network connection and repository access permissions";
					console.error(`[GitInitializationService] ${error}`);
					return {
						success: false,
						wasCloned: false,
						error,
					};
				}
				return {
					success: true,
					wasCloned: true,
				};
			}
			console.log(
				"[GitInitializationService] Valid repository already exists, skipping clone",
			);
			const syncResult = await this.syncWithRemote();
			if (syncResult.success) {
				console.log(
					"[GitInitializationService] Successfully synced with remote",
				);
				return {
					success: true,
					wasCloned: false,
				};
			}
			console.warn(
				"[GitInitializationService] Failed to sync with remote:",
				syncResult.error,
			);
			return {
				success: true,
				wasCloned: false,
			};
		} catch (error) {
			return {
				success: false,
				wasCloned: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			console.log(
				`[GitInitializationService] Initialisation completed in: ${Math.round(performance.now() - initStart)}ms`,
			);
		}
	}

	/**
	 * Validates that the repository exists and is in a usable state.
	 * Returns both whether it exists and whether it's valid.
	 */
	private async validateRepository(): Promise<{
		exists: boolean;
		isValid: boolean;
		reason?: string;
	}> {
		try {
			const gitDir = new Directory(NOTES_ROOT, ".git");
			const dirExists = gitDir.exists;
			console.log(
				`[GitInitializationService] Checking ${gitDir.uri}: ${dirExists ? "EXISTS" : "NOT FOUND"}`,
			);

			// If directory doesn't exist, repo doesn't exist
			if (!dirExists) {
				return {
					exists: false,
					isValid: false,
					reason: "Directory does not exist",
				};
			}

			// Directory exists, verify it's a valid git repository
			const headFile = new File(gitDir, "HEAD");
			const configFile = new File(gitDir, "config");

			if (!headFile.exists) {
				return {
					exists: true,
					isValid: false,
					reason: "HEAD file not found - repository is incomplete",
				};
			}

			if (!configFile.exists) {
				return {
					exists: true,
					isValid: false,
					reason: "Config file not found - repository is incomplete",
				};
			}

			// Try to verify the repository is actually usable by checking if we can read basic info
			try {
				// Try to list branches - this will fail if the repository is corrupted
				await git.listBranches({
					fs: fs,
					dir: NOTES_ROOT,
				});

				console.log("[GitInitializationService] Valid git repository found");
				return { exists: true, isValid: true };
			} catch (gitError) {
				const errorMsg =
					gitError instanceof Error ? gitError.message : String(gitError);
				console.warn(
					`[GitInitializationService] Repository appears corrupted: ${errorMsg}`,
				);

				// Check for specific error types that indicate corruption
				if (
					errorMsg.includes("CommitNotFetchedError") ||
					errorMsg.includes("not available locally") ||
					errorMsg.includes("NotFoundError")
				) {
					return {
						exists: true,
						isValid: false,
						reason: `Repository corrupted: ${errorMsg}`,
					};
				}

				return {
					exists: true,
					isValid: false,
					reason: `Repository validation failed: ${errorMsg}`,
				};
			}
		} catch (error) {
			console.warn(
				"[GitInitializationService] Error validating repository:",
				error,
			);
			if (error instanceof Error && error.message.includes("permission")) {
				console.error(
					"File system permission error. Ensure app has storage permissions",
				);
			}
			return {
				exists: false,
				isValid: false,
				reason: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	private async cloneRepository(): Promise<boolean> {
		try {
			const { token, owner, repo } = this.config;

			const url = `https://github.com/${owner}/${repo}.git`;

			console.log("[GitInitializationService] Starting clone...");

			// Clone without checking out to avoid CommitNotFetchedError
			// We'll checkout manually after the clone completes
			await git.clone({
				fs: fs,
				dir: NOTES_ROOT,
				url,
				onAuth: () => ({ username: owner, password: token }),
				onPostCheckout: () => {
					console.log("[GitInitializationService] Checkout completed");
				},
				http,
				depth: 1,
				singleBranch: true,
				noCheckout: true,
			});

			// Now checkout the branch manually after clone completes
			try {
				console.log(
					"[GitInitializationService] Clone completed, checking out branch...",
				);
				// Checkout the branch
				await git.checkout({
					fs: fs,
					dir: NOTES_ROOT,
					ref: "main",
					onProgress: (progress) => {
						console.log(
							"[GitInitializationService] Checkout progress:",
							progress,
						);
					},
				});

				console.log(
					"[GitInitializationService] Successfully checked out branch: main",
				);
			} catch (checkoutError) {
				console.error(
					"[GitInitializationService] Error during checkout:",
					checkoutError,
				);
				// If checkout fails, try to continue - repository might still be usable
				console.warn(
					"[GitInitializationService] Checkout failed, but repository may still be usable",
				);
			}

			console.log(
				"[GitInitializationService] Clone and checkout completed, verifying repository...",
			);

			// Verify that key files exist after clone
			const headFile = new File(NOTES_ROOT, ".git/HEAD");
			const configFile = new File(NOTES_ROOT, ".git/config");

			// Wait a bit for file system operations to complete
			await new Promise((resolve) => setTimeout(resolve, 200));

			if (!headFile.exists) {
				console.error(
					"[GitInitializationService] HEAD file not found after clone - clone may have failed",
				);
				return false;
			}

			if (!configFile.exists) {
				console.error(
					"[GitInitializationService] Config file not found after clone - clone may have failed",
				);
				return false;
			}

			console.log(
				"[GitInitializationService] Repository verified successfully",
			);
			return true;
		} catch (error) {
			// Log all clone errors for debugging
			console.error("[GitInitializationService] Clone error:", error);

			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase();
				const errorCode = (error as Error & { code?: string }).code;

				// If clone fails due to repository corruption (CommitNotFetchedError, etc.),
				// clean up and suggest retry
				if (
					errorMessage.includes("commitnotfetched") ||
					errorMessage.includes("not available locally") ||
					errorMessage.includes("notfounderror")
				) {
					console.error(
						"[GitInitializationService] Clone failed due to repository corruption",
					);
					console.error(
						"[GitInitializationService] Attempting to clean up corrupted repository...",
					);

					await fs.promises.rmdir(NOTES_ROOT);
					return false;
				}

				// Log authentication errors with more detail
				if (
					errorMessage.includes("authentication failed") ||
					errorMessage.includes("401") ||
					errorMessage.includes("403")
				) {
					console.error(
						"[GitInitializationService] Authentication error details:",
					);
					console.error("  - Error:", error.message);
					return false;
				}

				// Network errors
				if (
					errorMessage.includes("network") ||
					errorMessage.includes("fetch") ||
					errorMessage.includes("connection")
				) {
					console.error(
						"[GitInitializationService] Network error:",
						error.message,
					);
					return false;
				}

				// File system permission errors
				if (
					errorMessage.includes("permission") ||
					errorCode === "EACCES" ||
					errorCode === "EPERM"
				) {
					console.error(
						"[GitInitializationService] File system permission error. Ensure app has storage permissions",
					);
					return false;
				}

				// ENOENT errors during clone might be expected, but if clone throws an error,
				// it likely means something went wrong
				if (errorCode === "ENOENT" || errorMessage.includes("enoent")) {
					console.warn(
						"[GitInitializationService] ENOENT error during clone - this may be expected, but clone failed",
					);
					return false;
				}
			}

			return false;
		}
	}

	/**
	 * Syncs the local repository with the remote by pulling the latest changes.
	 * Uses fast-forward merge if possible, otherwise attempts a merge.
	 */
	private async syncWithRemote(): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			const { token, owner } = this.config;

			console.log(
				"[GitInitializationService] Fetching latest changes from remote...",
			);
			const tFetch = performance.now();
			await git.fetch({
				fs: fs,
				dir: NOTES_ROOT,
				onAuth: () => ({ username: owner, password: token }),
				http,
				remote: "origin",
			});
			console.log(
				`[GitInitializationService] syncWithRemote git.fetch: ${Math.round(performance.now() - tFetch)}ms`,
			);

			const currentBranch = "main";
			const remoteBranch = `origin/${currentBranch}`;

			console.log(
				`[GitInitializationService] Attempting to merge from ${remoteBranch}...`,
			);

			try {
				const tMerge = performance.now();
				await git.merge({
					fs: fs,
					dir: NOTES_ROOT,
					ours: currentBranch,
					theirs: remoteBranch,
					fastForwardOnly: true,
				});
				console.log("[GitInitializationService] Fast-forward merge successful");
				// leaving this here for a while, if fast forward merges doesn't work then
				await git.checkout({
					fs,
					dir: NOTES_ROOT,
					ref: "HEAD",
					noUpdateHead: true,
					force: true,
				});
				return { success: true };
				// if I pull changes from remote and remote was more updated, I will face this error.
				// I think this was because I was attempting a fast-forward merge
			} catch (fastForwardError) {
				console.log(
					"[GitInitializationService] Fast-forward not possible, attempting regular merge...",
				);
				try {
					const tMerge = performance.now();
					await git.merge({
						fs: fs,
						dir: NOTES_ROOT,
						ours: currentBranch,
						theirs: remoteBranch,
						author: {
							name: "Git Sync",
							email: "sync@keeper.app",
						},
						message: "Merge remote changes",
					});
					console.log(
						`[GitInitializationService] syncWithRemote git.merge (regular): ${Math.round(performance.now() - tMerge)}ms`,
					);
					console.log("[GitInitializationService] Merge successful");
					const tCheckout = performance.now();
					await git.checkout({
						fs,
						dir: NOTES_ROOT,
						ref: "HEAD",
						noUpdateHead: true,
						force: true,
					});
					console.log(
						`[GitInitializationService] syncWithRemote git.checkout: ${Math.round(performance.now() - tCheckout)}ms`,
					);
					return { success: true };
				} catch (mergeError) {
					const errorMsg =
						mergeError instanceof Error
							? mergeError.message
							: String(mergeError);
					console.error("[GitInitializationService] Merge failed:", errorMsg);
					return { success: false, error: errorMsg };
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("[GitInitializationService] Sync failed:", errorMsg);
			return { success: false, error: errorMsg };
		}
	}
}
