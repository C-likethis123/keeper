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

			// Checkout local main, creating it from origin/main if absent
			try {
				await this.gitEngine.checkout(NOTES_ROOT, "main");
			} catch {
				await this.gitEngine.createBranch(NOTES_ROOT, "main", "origin/main");
				await this.gitEngine.checkout(NOTES_ROOT, "main");
			}

			let usedFastForward = true;

			for (const branch of deviceBranches) {
				const remoteRef = `origin/${branch}`;

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
						const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
						if (msg.startsWith("MERGE_CONFLICT")) {
							const conflicts = await this.gitEngine.getConflictedFiles(NOTES_ROOT);
							telemetry.trace("git.reconcile_conflict_detected", { branch, conflictCount: conflicts.length });
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
					await this.gitEngine.checkout(NOTES_ROOT, deviceBranch, {
						force: true,
					});
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
