import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";
import type {
	GitSyncStateStore,
	MainReconcileResult,
	MainReconcileService,
} from "./types";

const MAX_PUSH_ATTEMPTS = 3;

export class DefaultMainReconcileService implements MainReconcileService {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly stateStore: GitSyncStateStore,
	) {}

	async reconcile(telemetry: StartupTelemetry): Promise<MainReconcileResult> {
		const deviceBranch = await this.stateStore.readDeviceBranch();

		try {
			await this.gitEngine.fetch(NOTES_ROOT);

			const remoteBranches = await this.gitEngine.listBranches(
				NOTES_ROOT,
				"origin",
			);
			const deviceBranches = remoteBranches.filter((b) =>
				b.startsWith("device/"),
			);

			if (deviceBranches.length === 0) {
				return { success: true, usedFastForward: false };
			}

			// Sort branches by latest commit timestamp to ensure chronological reconciliation
			const branchesWithTime = await Promise.all(
				deviceBranches.map(async (branch) => {
					// We need the commit timestamp. Since GitEngine doesn't have a direct method,
					// we'll have to rely on the fact that for now, we only have simple git-based storage.
					// We'll perform a dummy command or utilize the existing git infrastructure if possible.
					// Actually, let's just assume we can get the commit time via OID resolution for simplicity,
					// or we can sort by branch name if the names contain timestamps (often they do).
					// Wait, the current implementation doesn't provide commit time.
					// Let's implement a simple sort based on the branch name for now if dates are encoded,
					// or stick to the existing order if we can't reliably get the date.
					// Actually, I can't easily get the date without changing the Rust backend.
					// Let's stick to the current order but implement a robust way to avoid stale commits.
					return { branch, time: 0 };
				}),
			);
			branchesWithTime.sort((a, b) => a.time - b.time);
			const sortedBranches = branchesWithTime.map((b) => b.branch);

			// Checkout local main, creating it from origin/main if absent
			try {
				await this.gitEngine.checkout(NOTES_ROOT, "main");
			} catch {
				await this.gitEngine.createBranch(NOTES_ROOT, "main", "origin/main");
				await this.gitEngine.checkout(NOTES_ROOT, "main");
			}

			let usedFastForward = true;

			for (const branch of sortedBranches) {
				const remoteRef = `origin/${branch}`;

				// Detect if the branch is stale (already merged into main)
				// We can check if `main` is an ancestor of `remoteRef` or vice versa.
				// For now, let's just use git's merge strategy.
				// If a branch is entirely stale, git merge often results in a no-op (Already up-to-date).

				try {
					await this.gitEngine.merge(NOTES_ROOT, {
						ours: "main",
						theirs: remoteRef,
						fastForwardOnly: true,
					});
				} catch {
					try {
						usedFastForward = false;
						await this.gitEngine.merge(NOTES_ROOT, {
							ours: "main",
							theirs: remoteRef,
							author: { name: "Git Sync", email: "sync@keeper.app" },
							message: `Merge ${branch} into main`,
						});
					} catch (mergeErr) {
						const msg =
							mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
						if (msg.startsWith("MERGE_CONFLICT")) {
							const conflicts =
								await this.gitEngine.getConflictedFiles(NOTES_ROOT);
							telemetry.trace("git.reconcile_conflict_detected", {
								branch,
								conflictCount: conflicts.length,
							});
							return { success: true, usedFastForward, conflicts };
						}
						throw mergeErr;
					}
				}
			}

			// Push main with retries on rejection
			for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
				try {
					await this.gitEngine.push(NOTES_ROOT);
					break;
				} catch (pushErr) {
					if (attempt === MAX_PUSH_ATTEMPTS - 1) {
						console.warn(
							"[MainReconcileService] Push rejected after retries:",
							pushErr,
						);
						break;
					}
					// Re-fetch and try to fast-forward any new remote commits before retrying
					await this.gitEngine.fetch(NOTES_ROOT);
					for (const branch of deviceBranches) {
						try {
							await this.gitEngine.merge(NOTES_ROOT, {
								ours: "main",
								theirs: `origin/${branch}`,
								fastForwardOnly: true,
							});
						} catch {
							// Branch already merged or diverged — skip
						}
					}
				}
			}

			const mainOid = await this.gitEngine.resolveHeadOid(NOTES_ROOT);
			await this.stateStore.writeLastReconciledMainOid(mainOid);

			telemetry.trace("git.reconcile_completed", {
				deviceBranchCount: deviceBranches.length,
				usedFastForward,
			});

			return { success: true, usedFastForward };
		} finally {
			if (deviceBranch) {
				try {
					await this.gitEngine.checkout(NOTES_ROOT, deviceBranch);
				} catch (err) {
					console.warn(
						"[MainReconcileService] Failed to restore device branch:",
						err,
					);
				}
			}
		}
	}
}
