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
	const token = process.env.EXPO_GITHUB_TOKEN || process.env.EXPO_PUBLIC_GITHUB_TOKEN;
	if (!owner || !repo) {
		throw new Error(
			"GitHub owner and repo not configured. Set EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO",
		);
	}
	if (!token) {
		throw new Error(
			"GitHub token not configured. Set EXPO_GITHUB_TOKEN",
		);
	}
	return { owner, repo, token };
}

export interface RepositoryStatus {
	hasUncommitted: boolean;
	isBehind: boolean;
	isAhead: boolean;
	currentBranch: string;
	lastCommit?: string;
}

export interface InitializationResult {
	success: boolean;
	wasCloned: boolean;
	status?: RepositoryStatus;
	error?: string;
}

export class GitInitializationService {
	static readonly instance = new GitInitializationService();
	private readonly config = assertGitHubConfig();

	private constructor() {}
	async initialize(): Promise<InitializationResult> {
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
					status: {
						hasUncommitted: false,
						isBehind: false,
						isAhead: false,
						currentBranch: "main",
					},
				};

				// const verifyRepoValidation = await this.validateRepository();
				// if (!verifyRepoValidation.isValid) {
				//     const error = 'Repository clone appeared to succeed but repository is invalid';
				//     console.error(`[GitInitializationService] ${error}`);
				//     return {
				//         success: false,
				//         wasCloned: false,
				//         error,
				//     };
				// }
				// console.log('[GitInitializationService] Repository verified successfully after clone');
			} else {
				console.log(
					"[GitInitializationService] Valid repository already exists, skipping clone",
				);
				const status = await this.checkRepositoryStatus();
				console.log(
					status.hasUncommitted
						? "[GitInitializationService] Syncing with remote (may have uncommitted changes)..."
						: "[GitInitializationService] Syncing with remote...",
				);
				const syncResult = await this.syncWithRemote();
				if (syncResult.success) {
					console.log(
						"[GitInitializationService] Successfully synced with remote",
					);
					const updatedStatus = await this.checkRepositoryStatus();
					return {
						success: true,
						wasCloned: false,
						status: updatedStatus,
					};
				}
				console.warn(
					"[GitInitializationService] Failed to sync with remote:",
					syncResult.error,
				);
				return {
					success: true,
					wasCloned: false,
					status,
				};
			}
		} catch (error) {
			return {
				success: false,
				wasCloned: false,
				error: error instanceof Error ? error.message : String(error),
			};
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
			const gitDirPath = `${NOTES_ROOT}.git`;
			const gitDir = new Directory(gitDirPath);
			const dirExists = gitDir.exists;
			console.log(
				`[GitInitializationService] Checking ${gitDirPath}: ${dirExists ? "EXISTS" : "NOT FOUND"}`,
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
			const headFile = new File(`${gitDirPath}/HEAD`);
			const configFile = new File(`${gitDirPath}/config`);

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

				console.log(`[GitInitializationService] Valid git repository found`);
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

			// Use clean URL without token - isomorphic-git will handle auth via token parameter
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
					`[GitInitializationService] Successfully checked out branch: main`,
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
			const headFile = new File(`${NOTES_ROOT}.git/HEAD`);
			const configFile = new File(`${NOTES_ROOT}.git/config`);

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
				const errorCode = (error as any).code;

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

	private async checkRepositoryStatus(): Promise<RepositoryStatus> {
		try {
			// First check if HEAD exists - if not, repository isn't properly initialized
			try {
				const headFile = new File(`${NOTES_ROOT}.git/HEAD`);
				if (!headFile.exists) {
					console.warn(
						"[GitInitializationService] HEAD file not found - repository may not be fully cloned",
					);
					return {
						hasUncommitted: false,
						isBehind: false,
						isAhead: false,
						currentBranch: "main",
					};
				}
			} catch (headError) {
				console.warn(
					"[GitInitializationService] Could not check HEAD file:",
					headError,
				);
				return {
					hasUncommitted: false,
					isBehind: false,
					isAhead: false,
					currentBranch: "main",
				};
			}

			// Try to get current branch first - this will fail if HEAD doesn't exist
			let currentBranch = "main";
			let lastCommit: string | undefined;

			try {
				const branches = await git.listBranches({
					fs: fs,
					dir: NOTES_ROOT,
				});
				currentBranch =
					branches.find((b) => !b.startsWith("origin/")) || "main";
			} catch (branchError) {
				console.warn(
					"[GitInitializationService] Could not list branches:",
					branchError,
				);
			}

			// Check if HEAD points to a valid commit before trying status operations
			let headCommitExists = false;
			let headCommitSha: string | undefined;
			try {
				const headSha = await git.resolveRef({
					fs: fs,
					dir: NOTES_ROOT,
					ref: "HEAD",
				});
				headCommitSha = headSha;

				// Try to read the commit to verify it exists
				try {
					await git.readCommit({
						fs: fs,
						dir: NOTES_ROOT,
						oid: headSha,
					});
					headCommitExists = true;
				} catch (readError) {
					console.warn(
						`[GitInitializationService] HEAD points to commit ${headSha.substring(0, 7)} but commit not found locally`,
					);
					headCommitExists = false;
				}
			} catch (headResolveError) {
				console.warn(
					"[GitInitializationService] Could not resolve HEAD:",
					headResolveError,
				);
			}

			// If HEAD commit doesn't exist, try to fetch it from remote
			if (!headCommitExists && headCommitSha) {
				console.log(
					"[GitInitializationService] Attempting to fetch missing commit from remote...",
				);
				const fetchResult = await this.fetchMissingCommit(headCommitSha);
				if (fetchResult) {
					console.log(
						"[GitInitializationService] Successfully fetched missing commit",
					);
					// Wait a bit longer for file system operations
					await new Promise((resolve) => setTimeout(resolve, 500));

					// Re-check if commit exists now - try multiple times with delays
					let commitFound = false;
					for (let attempt = 0; attempt < 3; attempt++) {
						try {
							await git.readCommit({
								fs: fs,
								dir: NOTES_ROOT,
								oid: headCommitSha,
							});
							headCommitExists = true;
							commitFound = true;
							console.log(
								`[GitInitializationService] Commit found after ${attempt + 1} attempt(s)`,
							);
							break;
						} catch (recheckError) {
							if (attempt < 2) {
								// Wait before retrying
								await new Promise((resolve) => setTimeout(resolve, 300));
							}
						}
					}

					if (!commitFound) {
						console.warn(
							"[GitInitializationService] Commit still not found after fetch attempt - attempting recovery",
						);
						// Try to recover by checking out remote branch
						await this.recoverFromMissingCommit(currentBranch);

						// After recovery, try one more time to see if commit exists
						try {
							await git.readCommit({
								fs: fs,
								dir: NOTES_ROOT,
								oid: headCommitSha,
							});
							headCommitExists = true;
							console.log(
								"[GitInitializationService] Commit found after recovery",
							);
						} catch (finalError) {
							console.warn(
								"[GitInitializationService] Commit still not accessible after recovery",
							);
						}
					}
				} else {
					// Fetch failed (likely auth error), try to recover by checking out remote branch
					console.log(
						"[GitInitializationService] Fetch failed, attempting to recover by checking out remote branch...",
					);
					await this.recoverFromMissingCommit(currentBranch);
				}
			}

			// Try to get status matrix - this requires a valid repository
			let hasUncommitted = false;
			if (headCommitExists) {
				try {
					const statusMatrix = await git.statusMatrix({
						fs: fs,
						dir: NOTES_ROOT,
					});

					hasUncommitted = statusMatrix.some(
						([, headStatus, workdirStatus, stageStatus]) => {
							return headStatus !== workdirStatus || headStatus !== stageStatus;
						},
					);
				} catch (statusError) {
					const errorMsg =
						statusError instanceof Error
							? statusError.message
							: String(statusError);
					console.warn(
						"[GitInitializationService] Could not get status matrix:",
						statusError,
					);
				}
			} else {
				console.warn(
					"[GitInitializationService] Skipping status matrix check - HEAD commit not found",
				);
			}

			// Try to get last commit
			if (headCommitExists) {
				try {
					const log = await git.log({
						fs: fs,
						dir: NOTES_ROOT,
						depth: 1,
					});
					lastCommit = log.length > 0 ? log[0].oid : undefined;
				} catch (logError) {
					const errorMsg =
						logError instanceof Error ? logError.message : String(logError);
					console.warn(
						"[GitInitializationService] Could not get commit log:",
						logError,
					);
				}
			} else {
				// If HEAD commit doesn't exist, try to get commit from remote branch
				try {
					const remoteBranches = await git.listBranches({
						fs: fs,
						dir: NOTES_ROOT,
						remote: "origin",
					});
					const remoteBranch = remoteBranches.find(
						(b) => b === "origin/main" || b === "origin/master",
					);
					if (remoteBranch) {
						const remoteLog = await git.log({
							fs: fs,
							dir: NOTES_ROOT,
							ref: remoteBranch,
							depth: 1,
						});
						if (remoteLog.length > 0) {
							lastCommit = remoteLog[0].oid;
							console.log(
								`[GitInitializationService] Using remote branch commit: ${lastCommit.substring(0, 7)}`,
							);
						}
					}
				} catch (remoteLogError) {
					console.warn(
						"[GitInitializationService] Could not get remote branch commit:",
						remoteLogError,
					);
				}
			}

			// Try to get remote status (this might also fail if repository isn't fully initialized or auth fails)
			let remoteStatus = { isBehind: false, isAhead: false };
			let remoteStatusError: Error | null = null;
			try {
				remoteStatus = await this.fetchRemoteStatus();
			} catch (remoteError) {
				remoteStatusError =
					remoteError instanceof Error
						? remoteError
						: new Error(String(remoteError));
				console.warn(
					"[GitInitializationService] Could not get remote status:",
					remoteError,
				);

				// If it's an auth error, we can't sync, but we should note it
				const errorMsg = remoteStatusError.message;
				if (errorMsg.includes("401") || errorMsg.includes("403")) {
					console.warn(
						"[GitInitializationService] WARNING: Cannot check remote status due to authentication error",
					);
					console.warn(
						"[GitInitializationService] Repository may be behind, but cannot verify or sync without valid token",
					);
				}
			}

			return {
				hasUncommitted,
				isBehind: remoteStatus.isBehind,
				isAhead: remoteStatus.isAhead,
				currentBranch,
				lastCommit,
			};
		} catch (error) {
			// If error is NotFoundError for HEAD, repository isn't initialized
			if (
				error instanceof Error &&
				(error.message.includes("HEAD") ||
					error.message.includes("NotFoundError"))
			) {
				console.warn(
					"[GitInitializationService] Repository not fully initialized - HEAD not found",
				);
				return {
					hasUncommitted: false,
					isBehind: false,
					isAhead: false,
					currentBranch: "main",
				};
			}

			console.error("[GitInitializationService] Status check error:", error);
			return {
				hasUncommitted: false,
				isBehind: false,
				isAhead: false,
				currentBranch: "main",
			};
		}
	}

	private async fetchRemoteStatus(): Promise<{
		isBehind: boolean;
		isAhead: boolean;
	}> {
		try {
			const { token, owner } = this.config;
			await git.fetch({
				fs,
				dir: NOTES_ROOT,
				onAuth: () => ({ username: owner, password: token }),
				http,
				remote: "origin",
			});

			const localBranches = await git.listBranches({
				fs: fs,
				dir: NOTES_ROOT,
			});

			const remoteBranches = await git.listBranches({
				fs: fs,
				dir: NOTES_ROOT,
				remote: "origin",
			});

			const currentBranch =
				localBranches.find((b) => !b.startsWith("origin/")) || "main";
			const remoteBranch = `origin/${currentBranch}`;

			if (!remoteBranches.includes(remoteBranch)) {
				return { isBehind: false, isAhead: false };
			}

			const localLog = await git.log({
				fs: fs,
				dir: NOTES_ROOT,
				ref: currentBranch,
				depth: 1,
			});

			const remoteLog = await git.log({
				fs: fs,
				dir: NOTES_ROOT,
				ref: remoteBranch,
				depth: 1,
			});

			if (localLog.length === 0 || remoteLog.length === 0) {
				return { isBehind: false, isAhead: false };
			}

			const localCommit = localLog[0].oid;
			const remoteCommit = remoteLog[0].oid;

			// Check if commits are the same
			if (localCommit === remoteCommit) {
				return { isBehind: false, isAhead: false };
			}

			// Check if local is behind by seeing if remote commit is in local history
			let isBehind = false;
			let isAhead = false;

			try {
				// Use findMergeBase to find the common ancestor
				// First, resolve the refs to commit OIDs
				const localOid = await git.resolveRef({
					fs: fs,
					dir: NOTES_ROOT,
					ref: currentBranch,
				});
				const remoteOid = await git.resolveRef({
					fs: fs,
					dir: NOTES_ROOT,
					ref: remoteBranch,
				});

				const mergeBases = await git.findMergeBase({
					fs: fs,
					dir: NOTES_ROOT,
					oids: [localOid, remoteOid],
				});

				if (!mergeBases || mergeBases.length === 0) {
					// No common ancestor - branches are unrelated
					throw new Error("No common ancestor found");
				}

				// Use the first merge base (most recent common ancestor)
				const mergeBase = mergeBases[0];

				if (mergeBase === localCommit && mergeBase !== remoteCommit) {
					// Local is at the common ancestor, remote has moved ahead
					isBehind = true;
				} else if (mergeBase === remoteCommit && mergeBase !== localCommit) {
					// Remote is at the common ancestor, local has moved ahead
					isAhead = true;
				} else if (mergeBase !== localCommit && mergeBase !== remoteCommit) {
					// Diverged - both have moved
					// Count commits from merge base to each branch
					const localHistory = await git.log({
						fs: fs,
						dir: NOTES_ROOT,
						ref: currentBranch,
					});
					const remoteHistory = await git.log({
						fs: fs,
						dir: NOTES_ROOT,
						ref: remoteBranch,
					});

					// Find index of merge base in each history
					const localBaseIndex = localHistory.findIndex(
						(c) => c.oid === mergeBase,
					);
					const remoteBaseIndex = remoteHistory.findIndex(
						(c) => c.oid === mergeBase,
					);

					// If merge base is found, count commits since then
					// If not found, assume we're behind (remote has commits we don't have)
					if (localBaseIndex === -1 && remoteBaseIndex >= 0) {
						isBehind = true;
					} else if (remoteBaseIndex === -1 && localBaseIndex >= 0) {
						isAhead = true;
					} else if (localBaseIndex >= 0 && remoteBaseIndex >= 0) {
						// Both found - compare distances
						if (remoteBaseIndex < localBaseIndex) {
							isBehind = true;
						}
						if (localBaseIndex < remoteBaseIndex) {
							isAhead = true;
						}
					}
				}
			} catch (error) {
				// Fallback: Check if remote commit is in local history
				try {
					const localHistory = await git.log({
						fs: fs,
						dir: NOTES_ROOT,
						ref: currentBranch,
					});
					isBehind = !localHistory.some(
						(commit) => commit.oid === remoteCommit,
					);

					const remoteHistory = await git.log({
						fs: fs,
						dir: NOTES_ROOT,
						ref: remoteBranch,
					});
					isAhead = !remoteHistory.some((commit) => commit.oid === localCommit);
				} catch (fallbackError) {
					console.warn(
						"[GitInitializationService] Could not determine branch sync status:",
						fallbackError,
					);
					return { isBehind: false, isAhead: false };
				}
			}

			return { isBehind, isAhead };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.warn(
				"[GitInitializationService] Remote status check error:",
				error,
			);

			// Log more details about 401 errors
			if (errorMsg.includes("401") || errorMsg.includes("403")) {
				console.warn(
					"[GitInitializationService] Authentication error - check GitHub token permissions",
				);
				console.warn(
					'[GitInitializationService] Token needs "repo" scope for private repositories',
				);
				console.warn(
					"[GitInitializationService] Cannot determine if repository is behind without remote access",
				);
			}

			// If we can't check remote status, we can't know if we're behind
			// Return false to avoid false positives, but log that we couldn't check
			return { isBehind: false, isAhead: false };
		}
	}

	/**
	 * Attempts to fetch a specific missing commit from the remote repository.
	 * Returns true if successful, false otherwise.
	 */
	private async fetchMissingCommit(commitSha: string): Promise<boolean> {
		try {
			const { token, owner } = this.config;

			// Fetch from remote - this should bring in the missing commit
			// Fetch all branches and tags to ensure we get the commit
			await git.fetch({
				fs: fs,
				dir: NOTES_ROOT,
				onAuth: () => ({ username: owner, password: token }),
				http,
				remote: "origin",
				singleBranch: false, // Fetch all branches to get the commit
				tags: true, // Also fetch tags
			});

			// Wait a moment for file system operations to complete
			await new Promise((resolve) => setTimeout(resolve, 200));

			return true;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.warn(
				`[GitInitializationService] Failed to fetch missing commit ${commitSha.substring(0, 7)}:`,
				errorMsg,
			);

			if (errorMsg.includes("401") || errorMsg.includes("403")) {
				console.warn(
					"[GitInitializationService] Authentication failed - cannot fetch missing commit",
				);
				console.warn(
					'[GitInitializationService] Please check your GitHub token has "repo" scope',
				);
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
			await git.fetch({
				fs: fs,
				dir: NOTES_ROOT,
				onAuth: () => ({ username: owner, password: token }),
				http,
				remote: "origin",
			});

			const branches = await git.listBranches({
				fs: fs,
				dir: NOTES_ROOT,
			});
			const currentBranch =
				branches.find((b) => !b.startsWith("origin/")) || "main";
			const remoteBranch = `origin/${currentBranch}`;

			console.log(
				`[GitInitializationService] Attempting to merge from ${remoteBranch}...`,
			);

			try {
				await git.merge({
					fs: fs,
					dir: NOTES_ROOT,
					ours: currentBranch,
					theirs: remoteBranch,
					fastForwardOnly: true,
				});
				console.log("[GitInitializationService] Fast-forward merge successful");
				await git.checkout({
					fs,
					dir: NOTES_ROOT,
					ref: "HEAD",
					noUpdateHead: true,
					force: true,
				});
				return { success: true };
			} catch (fastForwardError) {
				console.log(
					"[GitInitializationService] Fast-forward not possible, attempting regular merge...",
				);
				try {
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
					console.log("[GitInitializationService] Merge successful");
					await git.checkout({
						fs,
						dir: NOTES_ROOT,
						ref: "HEAD",
						noUpdateHead: true,
						force: true,
					});
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

	/**
	 * Attempts to recover from a missing HEAD commit by checking out the remote branch.
	 * This is a fallback when we can't fetch the missing commit (e.g., due to auth errors).
	 */
	private async recoverFromMissingCommit(currentBranch: string): Promise<void> {
		try {
			// First, try to fetch remote branches if they're not available
			const { token, owner, repo } = this.config;

			if (owner && repo && token) {
				try {
					console.log(
						"[GitInitializationService] Fetching remote branches for recovery...",
					);
					await git.fetch({
						fs: fs,
						dir: NOTES_ROOT,
						onAuth: () => ({ username: owner, password: token }),
						http,
						remote: "origin",
						singleBranch: false,
					});
					// Wait for file system to sync
					await new Promise((resolve) => setTimeout(resolve, 200));
				} catch (fetchError) {
					console.warn(
						"[GitInitializationService] Could not fetch remote branches for recovery:",
						fetchError,
					);
				}
			}

			// Now try to list remote branches
			let remoteBranches: string[] = [];
			try {
				remoteBranches = await git.listBranches({
					fs: fs,
					dir: NOTES_ROOT,
					remote: "origin",
				});
				console.log(
					`[GitInitializationService] Found ${remoteBranches.length} remote branches: ${remoteBranches.join(", ")}`,
				);
			} catch (listError) {
				console.warn(
					"[GitInitializationService] Could not list remote branches:",
					listError,
				);
			}

			// Try to find a suitable remote branch to checkout
			// Handle both "origin/main" and "main" formats
			// Filter out "HEAD" as it's not a real branch
			const validBranches = remoteBranches.filter(
				(b) => b !== "HEAD" && b !== "origin/HEAD",
			);
			console.log(
				`[GitInitializationService] Filtered branches (excluding HEAD): ${validBranches.join(", ")}`,
			);

			let remoteBranch: string | undefined = validBranches.find(
				(b) =>
					b === `origin/${currentBranch}` ||
					b === "origin/main" ||
					b === "origin/master",
			);

			// If not found with prefix, try without prefix
			if (!remoteBranch) {
				remoteBranch = validBranches.find(
					(b) => b === currentBranch || b === "main" || b === "master",
				);
			}

			console.log(
				`[GitInitializationService] Selected remote branch for recovery: ${remoteBranch || "none"}`,
			);

			if (remoteBranch) {
				console.log(
					`[GitInitializationService] Attempting to checkout ${remoteBranch} to recover...`,
				);

				// Determine the branch name (with or without origin/ prefix)
				const branchName = remoteBranch.startsWith("origin/")
					? remoteBranch.replace("origin/", "")
					: remoteBranch;

				// Try multiple strategies
				let checkoutSuccess = false;

				// Strategy 1: Checkout the remote branch directly (if it has origin/ prefix)
				if (remoteBranch.startsWith("origin/")) {
					try {
						await git.checkout({
							fs: fs,
							dir: NOTES_ROOT,
							ref: remoteBranch,
						});
						console.log(
							`[GitInitializationService] Successfully checked out ${remoteBranch} directly`,
						);
						checkoutSuccess = true;
					} catch (checkoutError) {
						console.warn(
							`[GitInitializationService] Direct checkout failed:`,
							checkoutError,
						);
					}
				}

				// Strategy 2: Create/checkout local branch tracking remote
				if (!checkoutSuccess) {
					try {
						await git.checkout({
							fs: fs,
							dir: NOTES_ROOT,
							ref: branchName,
							track: true,
						});
						console.log(
							`[GitInitializationService] Successfully created local branch ${branchName} tracking remote`,
						);
						checkoutSuccess = true;
					} catch (trackError) {
						console.warn(
							`[GitInitializationService] Tracking branch checkout failed:`,
							trackError,
						);
					}
				}

				// Strategy 3: Just checkout the branch name (might work if it exists)
				if (!checkoutSuccess) {
					try {
						await git.checkout({
							fs: fs,
							dir: NOTES_ROOT,
							ref: branchName,
						});
						console.log(
							`[GitInitializationService] Successfully checked out ${branchName}`,
						);
						checkoutSuccess = true;
					} catch (simpleCheckoutError) {
						console.warn(
							`[GitInitializationService] Simple checkout failed:`,
							simpleCheckoutError,
						);
					}
				}

				// Strategy 4: Try to update HEAD to point to origin/main explicitly
				if (!checkoutSuccess) {
					try {
						// Try to resolve the remote branch reference
						// Handle both "origin/main" and "main" formats
						let remoteRef: string;
						if (remoteBranch.startsWith("origin/")) {
							remoteRef = remoteBranch;
						} else {
							// Try both formats
							remoteRef = `origin/${remoteBranch}`;
						}

						let remoteOid: string;
						// Try resolving in order: the branch as-is, then with origin/ prefix, then without
						try {
							remoteOid = await git.resolveRef({
								fs: fs,
								dir: NOTES_ROOT,
								ref: remoteBranch,
							});
						} catch (resolveError1) {
							try {
								remoteOid = await git.resolveRef({
									fs: fs,
									dir: NOTES_ROOT,
									ref: remoteRef,
								});
							} catch (resolveError2) {
								// Last try: if remoteBranch is "main", try "refs/remotes/origin/main"
								remoteOid = await git.resolveRef({
									fs: fs,
									dir: NOTES_ROOT,
									ref: `refs/remotes/origin/${branchName}`,
								});
							}
						}

						// Update HEAD to point to this commit
						await git.writeRef({
							fs: fs,
							dir: NOTES_ROOT,
							ref: "HEAD",
							value: remoteOid,
						});
						console.log(
							`[GitInitializationService] Successfully updated HEAD to ${remoteOid.substring(0, 7)}`,
						);
						checkoutSuccess = true;
					} catch (writeRefError) {
						console.warn(
							`[GitInitializationService] Failed to update HEAD:`,
							writeRefError,
						);
					}
				}

				if (checkoutSuccess) {
					// Wait for file system to sync
					await new Promise((resolve) => setTimeout(resolve, 300));
				}
			} else {
				console.warn(
					`[GitInitializationService] No suitable remote branch found. Available branches: ${remoteBranches.join(", ") || "none"}`,
				);

				// Last resort: try to checkout 'main' or resolve origin/main
				const branchesToTry = [
					"main",
					"origin/main",
					"master",
					"origin/master",
				];
				for (const branchToTry of branchesToTry) {
					try {
						console.log(
							`[GitInitializationService] Attempting to resolve ${branchToTry} as last resort...`,
						);
						const branchOid = await git.resolveRef({
							fs: fs,
							dir: NOTES_ROOT,
							ref: branchToTry,
						});

						// Update HEAD to point to this commit
						await git.writeRef({
							fs: fs,
							dir: NOTES_ROOT,
							ref: "HEAD",
							value: branchOid,
						});
						console.log(
							`[GitInitializationService] Successfully updated HEAD to ${branchOid.substring(0, 7)} from ${branchToTry})`,
						);
						await new Promise((resolve) => setTimeout(resolve, 200));
						break;
					} catch (resolveError) {
						// Try next branch
						continue;
					}
				}
			}
		} catch (error) {
			console.warn(
				"[GitInitializationService] Recovery attempt failed:",
				error,
			);
		}
	}
}
