import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";
import { getGitRuntimeSupport } from "../runtime";
import type {
	DbSyncService,
	GitSyncStateStore,
	MainReconcileService,
	RemoteSyncMetrics,
	RemoteSyncService,
	SyncWithRemoteResult,
} from "./types";

function createEmptyRemoteSyncMetrics(): RemoteSyncMetrics {
	return {
		fetchMs: 0,
		resolveHeadBeforeMs: 0,
		resolveHeadAfterMs: 0,
		branchResolveMs: 0,
		remoteBranchListMs: 0,
		currentBranchResolveMs: 0,
		mergeMs: 0,
		fastForwardMergeMs: 0,
		regularMergeMs: 0,
		checkoutMs: 0,
		dbSyncMs: 0,
		readLastSyncedOidMs: 0,
		writeLastSyncedOidMs: 0,
		changedPathsMs: 0,
		indexSyncMs: 0,
		usedFastForward: false,
		didHeadChange: false,
		didDbSync: false,
	};
}

export class DefaultRemoteSyncService implements RemoteSyncService {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly dbSyncService: DbSyncService,
		private readonly stateStore: GitSyncStateStore,
		private readonly mainReconcileService: MainReconcileService,
	) {}

	private async ensureDeviceBranch(): Promise<string> {
		const existing = await this.stateStore.readDeviceBranch();
		if (existing) return existing;

		let deviceId = await this.stateStore.readDeviceId();
		if (!deviceId) {
			deviceId = Math.random().toString(16).slice(2, 10);
			await this.stateStore.writeDeviceId(deviceId);
		}

		const runtime = getGitRuntimeSupport().runtime;
		const platform = runtime === "desktop-tauri" ? "desktop" : "mobile";
		const branchName = `device/${platform}-${deviceId}`;

		try {
			await this.gitEngine.createBranch(NOTES_ROOT, branchName, "main");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (!msg.toLowerCase().includes("already exists")) {
				throw err;
			}
		}

		await this.stateStore.writeDeviceBranch(branchName);
		return branchName;
	}

	private pickPreferredBranch(branches: string[]): string | undefined {
		if (branches.includes("main")) return "main";
		if (branches.includes("master")) return "master";
		return branches[0];
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

			const tHeadBefore = performance.now();
			const headBeforeSync = await this.gitEngine.resolveHeadOid(NOTES_ROOT);
			metrics.resolveHeadBeforeMs = Math.round(performance.now() - tHeadBefore);
			telemetry.trace("git.resolve_head_before_sync_completed", {
				durationMs: metrics.resolveHeadBeforeMs,
				headOidPrefix: headBeforeSync.slice(0, 7),
			});

			const tBranchResolve = performance.now();
			const tRemoteBranches = performance.now();
			const remoteBranches = await this.gitEngine.listBranches(
				NOTES_ROOT,
				"origin",
			);
			metrics.remoteBranchListMs = Math.round(
				performance.now() - tRemoteBranches,
			);
			telemetry.trace("git.remote_branches_listed", {
				durationMs: metrics.remoteBranchListMs,
				remoteBranchCount: remoteBranches.length,
			});
			if (remoteBranches.length === 0) {
				return {
					success: false,
					error: "Remote has no branches",
					metrics,
				};
			}

			// Resolve or create the per-device branch
			const tCurrentBranchResolve = performance.now();
			const currentBranch = await this.ensureDeviceBranch();
			metrics.currentBranchResolveMs = Math.round(
				performance.now() - tCurrentBranchResolve,
			);
			telemetry.trace("git.current_branch_resolved", {
				durationMs: metrics.currentBranchResolveMs,
				currentBranch,
			});

			// Ensure HEAD is on the device branch
			const headBranch = await this.gitEngine.currentBranch(NOTES_ROOT);
			if (headBranch !== currentBranch) {
				const tCheckout = performance.now();
				await this.gitEngine.checkout(NOTES_ROOT, currentBranch);
				metrics.checkoutMs += Math.round(performance.now() - tCheckout);
				telemetry.trace("git.branch_checkout_completed", {
					durationMs: metrics.checkoutMs,
					branch: currentBranch,
					reason: "switch_to_device_branch",
				});
			}

			metrics.branchResolveMs = Math.round(performance.now() - tBranchResolve);

			// Always pull from origin/main so we pick up all devices' changes
			const mainBranch = remoteBranches.includes("main") ? "main" : (this.pickPreferredBranch(remoteBranches) ?? "main");
			const remoteBranch = `origin/${mainBranch}`;
			telemetry.trace("git.branch_resolution_completed", {
				durationMs: metrics.branchResolveMs,
				currentBranch,
				remoteBranch,
			});
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

					// Check if this is a merge conflict (not a hard failure)
					if (errorMsg.startsWith("MERGE_CONFLICT")) {
						// Detect the conflicted files and return them for UI resolution
						try {
							const conflictStatuses = await this.gitEngine.status(NOTES_ROOT);
							const conflictedPaths = conflictStatuses
								.filter((s) => s.status.includes("conflicted"))
								.map((s) => s.path);

							console.log(
								`[GitInitializationService] Detected ${conflictedPaths.length} conflicted files`,
							);

							// Get full conflict details (base, ours, theirs content)
							const conflictedFiles =
								await this.gitEngine.getConflictedFiles(NOTES_ROOT);

							// Return success=true with conflicts so the UI can handle them
							return {
								success: true,
								metrics,
								conflicts: conflictedFiles,
							};
						} catch (conflictDetectError) {
							console.error(
								"[GitInitializationService] Failed to detect conflicts:",
								conflictDetectError,
							);
							// Fall through to error return
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

			// Fold all device branches into main after a successful pull
			const reconcileResult =
				await this.mainReconcileService.reconcile(telemetry);
			if (reconcileResult.conflicts && reconcileResult.conflicts.length > 0) {
				return { success: true, metrics, conflicts: reconcileResult.conflicts };
			}

			return { success: true, metrics };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("[GitInitializationService] Sync failed:", errorMsg);
			return { success: false, error: errorMsg, metrics };
		}
	}
}
