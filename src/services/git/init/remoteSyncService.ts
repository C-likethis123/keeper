import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";
import type {
	DbSyncService,
	GitSyncStateStore,
	RemoteSyncMetrics,
	RemoteSyncService,
	SyncWithRemoteResult,
} from "./types";
import { createEmptyStartupMetrics } from "./types";

const DEFAULT_BRANCH = "main";
const REMOTE_NAME = "origin";

type RemoteBranchResolution = {
	currentBranch: string;
	remoteMergeBranch: string;
	remoteBranch: string;
};

function createEmptyRemoteSyncMetrics(): RemoteSyncMetrics {
	const {
		validateRepoMs: _,
		totalMs: __,
		...empty
	} = createEmptyStartupMetrics();
	return empty;
}

export class DefaultRemoteSyncService implements RemoteSyncService {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly dbSyncService: DbSyncService,
		private readonly stateStore: GitSyncStateStore,
	) {}

	private async resolveRemoteBranch(
		metrics: RemoteSyncMetrics,
	): Promise<RemoteBranchResolution> {
		const branchResolveStart = performance.now();
		const currentBranch =
			(await this.gitEngine.currentBranch(NOTES_ROOT)) ?? DEFAULT_BRANCH;
		metrics.currentBranchResolveMs = Math.round(
			performance.now() - branchResolveStart,
		);

		const remoteBranchListStart = performance.now();
		const remoteBranches = await this.gitEngine.listBranches(
			NOTES_ROOT,
			REMOTE_NAME,
		);
		metrics.remoteBranchListMs = Math.round(
			performance.now() - remoteBranchListStart,
		);
		metrics.branchResolveMs =
			metrics.currentBranchResolveMs + metrics.remoteBranchListMs;

		const remoteMergeBranch = remoteBranches.includes(currentBranch)
			? currentBranch
			: DEFAULT_BRANCH;
		return {
			currentBranch,
			remoteMergeBranch,
			remoteBranch: `${REMOTE_NAME}/${remoteMergeBranch}`,
		};
	}

	async syncWithRemote(
		telemetry: StartupTelemetry,
	): Promise<SyncWithRemoteResult> {
		const metrics = createEmptyRemoteSyncMetrics();

		try {
			console.log(
				"[GitInitializationService] Fetching latest changes from remote...",
			);
			const tFetch = performance.now();
			await this.gitEngine.fetch(NOTES_ROOT);
			metrics.fetchMs = Math.round(performance.now() - tFetch);
			telemetry.trace("git.fetch_completed", {
				durationMs: metrics.fetchMs,
			});

			const tBeforeSync = performance.now();
			const headBeforeSync = await this.gitEngine.resolveHeadOid(NOTES_ROOT);
			metrics.resolveHeadBeforeMs = Math.round(performance.now() - tBeforeSync);
			telemetry.trace("git.resolve_head_before_sync_completed", {
				durationMs: metrics.resolveHeadBeforeMs,
				headOidPrefix: headBeforeSync.slice(0, 7),
			});

			const { currentBranch, remoteMergeBranch, remoteBranch } =
				await this.resolveRemoteBranch(metrics);

			telemetry.trace("git.branch_resolution_completed", {
				currentBranch,
				remoteMergeBranch,
				remoteBranch,
			});

			// Commit any uncommitted local changes before merging to avoid
			// "uncommitted change would be overwritten by merge" errors.
			const dirtyFiles = await this.gitEngine.status(NOTES_ROOT);
			if (dirtyFiles.length > 0) {
				console.log(
					`[GitInitializationService] Committing ${dirtyFiles.length} uncommitted file(s) before merge...`,
				);
				await this.gitEngine.commit(NOTES_ROOT, "Auto-save before sync");
				telemetry.trace("git.auto_save_before_sync", {
					fileCount: dirtyFiles.length,
				});
			}

			console.log(
				`[GitInitializationService] Attempting to merge from ${remoteBranch}...`,
			);

			try {
				const tMerge = performance.now();
				await this.gitEngine.merge(NOTES_ROOT, {
					ours: currentBranch,
					theirs: remoteBranch,
					fastForwardOnly: true,
				});
				metrics.usedFastForward = true;
				metrics.fastForwardMergeMs = Math.round(performance.now() - tMerge);
				metrics.mergeMs = metrics.fastForwardMergeMs;
				telemetry.trace("git.merge_completed", {
					mode: "fast_forward",
					durationMs: metrics.fastForwardMergeMs,
				});
			} catch {
				console.log(
					"[GitInitializationService] Fast-forward not possible, attempting regular merge...",
				);
				telemetry.trace("git.merge_fast_forward_failed", {
					mode: "fast_forward",
				});
				try {
					const tMerge = performance.now();
					await this.gitEngine.merge(NOTES_ROOT, {
						ours: currentBranch,
						theirs: remoteBranch,
						author: {
							name: "Git Sync",
							email: "sync@keeper.app",
						},
						message: "Merge remote changes",
					});
					metrics.regularMergeMs = Math.round(performance.now() - tMerge);
					metrics.mergeMs = metrics.regularMergeMs;
					telemetry.trace("git.merge_completed", {
						mode: "regular",
						durationMs: metrics.regularMergeMs,
					});
				} catch (mergeError) {
					const errorMsg =
						mergeError instanceof Error
							? mergeError.message
							: String(mergeError);
					console.error("[GitInitializationService] Merge failed:", errorMsg);

					if (errorMsg.includes("MERGE_CONFLICT")) {
						try {
							const conflictedFiles =
								await this.gitEngine.getConflictedFiles(NOTES_ROOT);
							console.log(
								`[GitInitializationService] Detected ${conflictedFiles.length} conflicted files`,
							);

							// Keep our local version in the original file; the caller
							// will write the incoming version as a *-sync_conflict file.
							for (const conflict of conflictedFiles) {
								await this.gitEngine.resolveConflict(
									NOTES_ROOT,
									conflict.path,
									"ours",
								);
							}

							await this.gitEngine.commit(
								NOTES_ROOT,
								"Resolve sync conflicts (local changes kept; incoming changes saved as *-sync_conflict files)",
							);

							// Push the resolution so our version is on the remote
							await this.gitEngine.push(NOTES_ROOT);

							return {
								success: true,
								metrics,
								conflicts: conflictedFiles,
							};
						} catch (conflictHandleError) {
							console.error(
								"[GitInitializationService] Failed to handle conflicts:",
								conflictHandleError,
							);
						}
					}

					return { success: false, error: errorMsg, metrics };
				}
			}

			const tHeadAfter = performance.now();
			const headAfterMerge = await this.gitEngine.resolveHeadOid(NOTES_ROOT);
			metrics.resolveHeadAfterMs = Math.round(performance.now() - tHeadAfter);
			metrics.didHeadChange = headBeforeSync !== headAfterMerge;
			telemetry.trace("git.resolve_head_after_sync_completed", {
				durationMs: metrics.resolveHeadAfterMs,
				headOidPrefix: headAfterMerge.slice(0, 7),
				didHeadChange: metrics.didHeadChange,
			});

			if (!metrics.didHeadChange) {
				const readStart = performance.now();
				const lastSyncedOid = await this.stateStore.readLastSyncedOid();
				metrics.readLastSyncedOidMs = Math.round(performance.now() - readStart);
				telemetry.trace("git.last_synced_oid_read", {
					durationMs: metrics.readLastSyncedOidMs,
					hasLastSyncedOid: Boolean(lastSyncedOid),
					context: "no_head_change",
				});
				if (!lastSyncedOid) {
					const writeStart = performance.now();
					await this.stateStore.writeLastSyncedOid(headAfterMerge);
					metrics.writeLastSyncedOidMs = Math.round(
						performance.now() - writeStart,
					);
					telemetry.trace("git.last_synced_oid_written", {
						durationMs: metrics.writeLastSyncedOidMs,
						context: "no_head_change",
					});
				}
				return { success: true, metrics };
			}

			const tCheckout = performance.now();
			await this.gitEngine.checkout(NOTES_ROOT, "HEAD", {
				noUpdateHead: true,
				force: true,
			});
			metrics.checkoutMs += Math.round(performance.now() - tCheckout);
			telemetry.trace("git.checkout_completed", {
				durationMs: metrics.checkoutMs,
				target: "HEAD",
				force: true,
			});

			const dbResult = await this.dbSyncService.syncDbAfterPull(
				headAfterMerge,
				telemetry,
			);
			metrics.dbSyncMs = dbResult.dbSyncMs;
			metrics.readLastSyncedOidMs = dbResult.readLastSyncedOidMs;
			metrics.writeLastSyncedOidMs = dbResult.writeLastSyncedOidMs;
			metrics.changedPathsMs = dbResult.changedPathsMs;
			metrics.indexSyncMs = dbResult.indexSyncMs;
			metrics.didDbSync = dbResult.didDbSync;

			return { success: true, metrics };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("[GitInitializationService] Sync failed:", errorMsg);
			return { success: false, error: errorMsg, metrics };
		}
	}
}
