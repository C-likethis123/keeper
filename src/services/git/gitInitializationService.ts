import { NOTES_ROOT } from "@/services/notes/Notes";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { useStorageStore } from "@/stores/storageStore";
import type { GitEngine } from "@/services/git/engines/GitEngine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory } from "expo-file-system";
import { getGitEngine } from "./gitEngine";

const LAST_SYNCED_OID_KEY = "git:lastSyncedOid";
const TLS_CERT_ERROR_PREFIX = "tls_cert_invalid";

async function readLastSyncedOid(): Promise<string | undefined> {
	try {
		const val = await AsyncStorage.getItem(LAST_SYNCED_OID_KEY);
		return val ?? undefined;
	} catch {
		return undefined;
	}
}

async function writeLastSyncedOid(oid: string): Promise<void> {
	try {
		await AsyncStorage.setItem(LAST_SYNCED_OID_KEY, oid);
	} catch (err) {
		console.warn(
			"[GitInitializationService] Failed to persist lastSyncedOid:",
			err,
		);
	}
}

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

interface StartupMetrics {
	validateRepoMs: number;
	fetchMs: number;
	branchResolveMs: number;
	mergeMs: number;
	checkoutMs: number;
	dbSyncMs: number;
	totalMs: number;
	usedFastForward: boolean;
	didHeadChange: boolean;
	didDbSync: boolean;
}

interface SyncWithRemoteResult {
	success: boolean;
	error?: string;
	metrics: Omit<StartupMetrics, "validateRepoMs" | "totalMs">;
}

interface SyncDbAfterPullResult {
	didDbSync: boolean;
	dbSyncMs: number;
}

function createEmptyStartupMetrics(): StartupMetrics {
	return {
		validateRepoMs: 0,
		fetchMs: 0,
		branchResolveMs: 0,
		mergeMs: 0,
		checkoutMs: 0,
		dbSyncMs: 0,
		totalMs: 0,
		usedFastForward: false,
		didHeadChange: false,
		didDbSync: false,
	};
}

export class GitInitializationService {
	static readonly instance = new GitInitializationService();
	private readonly config = assertGitHubConfig();
	private gitEngine: GitEngine | null = null;
	private lastCloneFailureMessage: string | undefined;

	private constructor() {}

	private ensureGitEngine(): GitEngine {
		if (this.gitEngine) {
			return this.gitEngine;
		}
		this.gitEngine = getGitEngine();
		return this.gitEngine;
	}

	private pickPreferredBranch(branches: string[]): string | undefined {
		if (branches.includes("main")) return "main";
		if (branches.includes("master")) return "master";
		return branches[0];
	}

	private isCertificateFailure(message: string): boolean {
		const normalized = message.toLowerCase();
		return (
			normalized.includes(TLS_CERT_ERROR_PREFIX) ||
			normalized.includes("ssl certificate is invalid") ||
			normalized.includes("certificate validation failed") ||
			normalized.includes("certificate verify failed")
		);
	}

	private buildCertificateFailureMessage(errorMessage: string): string {
		return [
			"TLS certificate validation failed while cloning from GitHub.",
			`Error detail: ${errorMessage}`,
			"Verify automatic date/time on the device, update the device trust store, and confirm https://github.com opens in the device browser before retrying.",
		].join(" ");
	}

	private async resolveCurrentBranch(): Promise<string | undefined> {
		const gitEngine = this.ensureGitEngine();
		const current = await gitEngine.currentBranch(NOTES_ROOT);
		if (current) return current;

		const localBranches = await gitEngine.listBranches(NOTES_ROOT);
		return this.pickPreferredBranch(localBranches);
	}

	async initialize(): Promise<InitializationResult> {
		const initStart = performance.now();
		const metrics = createEmptyStartupMetrics();
		console.log("[GitInitializationService] Starting initialization...");
		try {
			try {
				this.ensureGitEngine();
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown engine error";
				return {
					success: false,
					wasCloned: false,
					error: `Rust git unavailable: ${errorMsg}`,
				};
			}

			console.log(
				"[GitInitializationService] Checking if local repository exists and is valid...",
			);
			const tValidate = performance.now();
			const repoValidation = await this.validateRepository();
			metrics.validateRepoMs = Math.round(performance.now() - tValidate);
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
						this.lastCloneFailureMessage ??
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
			metrics.fetchMs = syncResult.metrics.fetchMs;
			metrics.branchResolveMs = syncResult.metrics.branchResolveMs;
			metrics.mergeMs = syncResult.metrics.mergeMs;
			metrics.checkoutMs = syncResult.metrics.checkoutMs;
			metrics.dbSyncMs = syncResult.metrics.dbSyncMs;
			metrics.usedFastForward = syncResult.metrics.usedFastForward;
			metrics.didHeadChange = syncResult.metrics.didHeadChange;
			metrics.didDbSync = syncResult.metrics.didDbSync;
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
			metrics.totalMs = Math.round(performance.now() - initStart);
			console.log("[GitInitializationService] Startup metrics", metrics);
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
			const gitEngine = this.ensureGitEngine();
			await gitEngine.resolveHeadOid(NOTES_ROOT);
			return { exists: true, isValid: true };
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
				reason:
					error instanceof Error ? error.message : "Repository not initialized",
			};
		}
	}

	private async cloneRepository(): Promise<boolean> {
		try {
			this.lastCloneFailureMessage = undefined;
			const gitEngine = this.ensureGitEngine();
			const { owner, repo } = this.config;

			const url = `https://github.com/${owner}/${repo}.git`;

			console.log("[GitInitializationService] Starting clone...");

			// Clone without checking out to avoid CommitNotFetchedError
			// We'll checkout manually after the clone completes
			await gitEngine.clone(url, NOTES_ROOT);

			// Now checkout the branch manually after clone completes
			try {
				console.log(
					"[GitInitializationService] Clone completed, checking out branch...",
				);
				const branches = await gitEngine.listBranches(NOTES_ROOT);
				const branchToCheckout = this.pickPreferredBranch(branches) ?? "main";
				// Checkout the branch
				await gitEngine.checkout(NOTES_ROOT, branchToCheckout);

				console.log(
					`[GitInitializationService] Successfully checked out branch: ${branchToCheckout}`,
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

					const capabilities = useStorageStore.getState().capabilities;
					if (capabilities.backend === "mobile-native") {
						const notesRootDir = new Directory(NOTES_ROOT);
						if (notesRootDir.exists) {
							await Promise.resolve(notesRootDir.delete());
						}
					}
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

				if (this.isCertificateFailure(errorMessage)) {
					const detailed = this.buildCertificateFailureMessage(error.message);
					this.lastCloneFailureMessage = detailed;
					console.error("[GitInitializationService] TLS certificate error:");
					console.error(
						"[GitInitializationService] 1) Verify device automatic date/time is enabled",
					);
					console.error(
						"[GitInitializationService] 2) Update device trust store / system certificates",
					);
					console.error(
						"[GitInitializationService] 3) Confirm https://github.com opens in the same device browser",
					);
					console.error(
						"[GitInitializationService] 4) Retry clone after the above checks",
					);
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

			this.lastCloneFailureMessage =
				"Failed to clone repository. Check network connection and repository access permissions";
			return false;
		}
	}

	/**
	 * Syncs the local repository with the remote by pulling the latest changes.
	 * Uses fast-forward merge if possible, otherwise attempts a merge.
	 */
	private async syncWithRemote(): Promise<SyncWithRemoteResult> {
		const metrics: SyncWithRemoteResult["metrics"] = {
			fetchMs: 0,
			branchResolveMs: 0,
			mergeMs: 0,
			checkoutMs: 0,
			dbSyncMs: 0,
			usedFastForward: false,
			didHeadChange: false,
			didDbSync: false,
		};
		try {
			const gitEngine = this.ensureGitEngine();
			console.log(
				"[GitInitializationService] Fetching latest changes from remote...",
			);
			const tFetch = performance.now();
			await gitEngine.fetch(NOTES_ROOT);
			metrics.fetchMs = Math.round(performance.now() - tFetch);

			const headBeforeSync = await gitEngine.resolveHeadOid(NOTES_ROOT);

			const tBranchResolve = performance.now();
			const remoteBranches = await gitEngine.listBranches(NOTES_ROOT, "origin");
			if (remoteBranches.length === 0) {
				return {
					success: false,
					error: "Remote has no branches",
					metrics,
				};
			}

			let currentBranch =
				(await this.resolveCurrentBranch()) ??
				this.pickPreferredBranch(remoteBranches) ??
				"main";
			if (!remoteBranches.includes(currentBranch)) {
				const fallbackBranch = this.pickPreferredBranch(remoteBranches);
				if (fallbackBranch) {
					console.log(
						`[GitInitializationService] Local branch '${currentBranch}' not found on remote; switching to '${fallbackBranch}'`,
					);
					currentBranch = fallbackBranch;
					const tCheckout = performance.now();
					await gitEngine.checkout(NOTES_ROOT, currentBranch);
					metrics.checkoutMs += Math.round(performance.now() - tCheckout);
				}
			}
			metrics.branchResolveMs = Math.round(performance.now() - tBranchResolve);

			const remoteBranch = `origin/${currentBranch}`;

			console.log(
				`[GitInitializationService] Attempting to merge from ${remoteBranch}...`,
			);

			try {
				const tMerge = performance.now();
				await gitEngine.merge(NOTES_ROOT, {
					ours: currentBranch,
					theirs: remoteBranch,
					fastForwardOnly: true,
				});
				metrics.usedFastForward = true;
				metrics.mergeMs = Math.round(performance.now() - tMerge);
			} catch {
				console.log(
					"[GitInitializationService] Fast-forward not possible, attempting regular merge...",
				);
				try {
					const tMerge = performance.now();
					await gitEngine.merge(NOTES_ROOT, {
						ours: currentBranch,
						theirs: remoteBranch,
						author: {
							name: "Git Sync",
							email: "sync@keeper.app",
						},
						message: "Merge remote changes",
					});
					metrics.mergeMs = Math.round(performance.now() - tMerge);
				} catch (mergeError) {
					const errorMsg =
						mergeError instanceof Error
							? mergeError.message
							: String(mergeError);
					console.error("[GitInitializationService] Merge failed:", errorMsg);
					return { success: false, error: errorMsg, metrics };
				}
			}

			const headAfterMerge = await gitEngine.resolveHeadOid(NOTES_ROOT);
			metrics.didHeadChange = headBeforeSync !== headAfterMerge;
			if (!metrics.didHeadChange) {
				const lastSyncedOid = await readLastSyncedOid();
				if (!lastSyncedOid) {
					await writeLastSyncedOid(headAfterMerge);
				}
				return { success: true, metrics };
			}

			const tCheckout = performance.now();
			await gitEngine.checkout(NOTES_ROOT, "HEAD", {
				noUpdateHead: true,
				force: true,
			});
			metrics.checkoutMs += Math.round(performance.now() - tCheckout);

			const dbResult = await this.syncDbAfterPull(headAfterMerge);
			metrics.dbSyncMs = dbResult.dbSyncMs;
			metrics.didDbSync = dbResult.didDbSync;
			return { success: true, metrics };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("[GitInitializationService] Sync failed:", errorMsg);
			return { success: false, error: errorMsg, metrics };
		}
	}

	private async syncDbAfterPull(currentOid?: string): Promise<SyncDbAfterPullResult> {
		const tSync = performance.now();
		let didDbSync = false;
		try {
			const gitEngine = this.ensureGitEngine();
			const resolvedCurrentOid =
				currentOid ?? (await gitEngine.resolveHeadOid(NOTES_ROOT));
			const lastSyncedOid = await readLastSyncedOid();

			if (!lastSyncedOid) {
				console.log(
					"[GitInitializationService] No lastSyncedOid — rebuilding DB from disk",
				);
				await NotesIndexService.rebuildFromDisk();
				didDbSync = true;
			} else if (lastSyncedOid !== resolvedCurrentOid) {
				console.log(
					`[GitInitializationService] Head changed from ${lastSyncedOid.slice(0, 7)} to ${resolvedCurrentOid.slice(0, 7)}, rebuilding index`,
				);
				await NotesIndexService.rebuildFromDisk();
				didDbSync = true;
			} else {
				console.log(
					"[GitInitializationService] No new commits since last sync, skipping DB sync",
				);
				return {
					didDbSync: false,
					dbSyncMs: 0,
				};
			}

			await writeLastSyncedOid(resolvedCurrentOid);
		} catch (err) {
			console.warn("[GitInitializationService] syncDbAfterPull failed:", err);
		}
		return {
			didDbSync,
			dbSyncMs: Math.round(performance.now() - tSync),
		};
	}
}
