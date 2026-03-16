import { NOTES_ROOT } from "@/services/notes/Notes";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { GitChangedPaths, GitEngine } from "@/services/git/engines/GitEngine";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";
import type { DbSyncService, GitSyncStateStore, SyncDbAfterPullResult } from "./types";

export class DefaultDbSyncService implements DbSyncService {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly stateStore: GitSyncStateStore,
	) {}

	private async getChangedMarkdownPaths(
		fromOid: string,
		toOid: string,
		telemetry: StartupTelemetry,
	): Promise<GitChangedPaths> {
		try {
			return await this.gitEngine.changedMarkdownPaths(NOTES_ROOT, fromOid, toOid);
		} catch (error) {
			telemetry.trace("git.changed_paths_fallback", {
				reason: "changed_markdown_paths_failed",
				errorMessage: error instanceof Error ? error.message : String(error),
			});
			console.warn(
				"[GitInitializationService] changedMarkdownPaths failed, falling back to full rebuild:",
				error,
			);
			return {
				added: [],
				modified: [],
				deleted: [],
			};
		}
	}

	async syncDbAfterPull(
		currentOid: string | undefined,
		telemetry: StartupTelemetry,
	): Promise<SyncDbAfterPullResult> {
		const tSync = performance.now();
		let didDbSync = false;
		let readLastSyncedOidMs = 0;
		let writeLastSyncedOidMs = 0;
		let changedPathsMs = 0;
		let indexSyncMs = 0;

		try {
			const resolvedCurrentOid =
				currentOid ?? (await this.gitEngine.resolveHeadOid(NOTES_ROOT));
			const readStart = performance.now();
			const lastSyncedOid = await this.stateStore.readLastSyncedOid();
			readLastSyncedOidMs = Math.round(performance.now() - readStart);
			telemetry.trace("git.last_synced_oid_read", {
				durationMs: readLastSyncedOidMs,
				hasLastSyncedOid: Boolean(lastSyncedOid),
				context: "post_pull",
			});

			if (!lastSyncedOid) {
				console.log(
					"[GitInitializationService] No lastSyncedOid — rebuilding DB from disk",
				);
				const indexSyncStart = performance.now();
				const syncResult = await NotesIndexService.rebuildFromDisk();
				indexSyncMs = Math.round(performance.now() - indexSyncStart);
				telemetry.trace("git.db_sync_completed", {
					syncMode: "full_rebuild",
					reason: "missing_last_synced_oid",
					indexSyncMs,
					...syncResult,
				});
				didDbSync = true;
			} else if (lastSyncedOid !== resolvedCurrentOid) {
				const changedPathsStart = performance.now();
				const changedPaths = await this.getChangedMarkdownPaths(
					lastSyncedOid,
					resolvedCurrentOid,
					telemetry,
				);
				changedPathsMs = Math.round(performance.now() - changedPathsStart);
				const changedPathCount =
					changedPaths.added.length +
					changedPaths.modified.length +
					changedPaths.deleted.length;
				console.log(
					`[GitInitializationService] Head changed from ${lastSyncedOid.slice(0, 7)} to ${resolvedCurrentOid.slice(0, 7)}, syncing index`,
					changedPaths,
				);
				telemetry.trace("git.changed_paths_computed", {
					durationMs: changedPathsMs,
					addedCount: changedPaths.added.length,
					modifiedCount: changedPaths.modified.length,
					deletedCount: changedPaths.deleted.length,
					changedPathCount,
				});
				const indexSyncStart = performance.now();
				const syncResult = await NotesIndexService.syncChangedPaths(changedPaths);
				indexSyncMs = Math.round(performance.now() - indexSyncStart);
				telemetry.trace("git.db_sync_completed", {
					syncMode: syncResult.mode,
					reason: "head_changed",
					indexSyncMs,
					changedPathCount: syncResult.changedPathCount,
					markdownChangedPathCount: syncResult.markdownChangedPathCount,
					metrics: syncResult.metrics as unknown as Record<string, unknown>,
				});
				didDbSync = true;
			} else {
				console.log(
					"[GitInitializationService] No new commits since last sync, skipping DB sync",
				);
				telemetry.trace("git.db_sync_skipped", {
					reason: "no_new_commits",
				});
				return {
					didDbSync: false,
					dbSyncMs: 0,
					readLastSyncedOidMs,
					writeLastSyncedOidMs,
					changedPathsMs,
					indexSyncMs,
				};
			}

			const writeStart = performance.now();
			await this.stateStore.writeLastSyncedOid(resolvedCurrentOid);
			writeLastSyncedOidMs = Math.round(performance.now() - writeStart);
			telemetry.trace("git.last_synced_oid_written", {
				durationMs: writeLastSyncedOidMs,
				context: "post_pull",
			});
		} catch (err) {
			telemetry.trace("git.db_sync_failed", {
				errorMessage: err instanceof Error ? err.message : String(err),
			});
			console.warn("[GitInitializationService] syncDbAfterPull failed:", err);
		}

		return {
			didDbSync,
			dbSyncMs: Math.round(performance.now() - tSync),
			readLastSyncedOidMs,
			writeLastSyncedOidMs,
			changedPathsMs,
			indexSyncMs,
		};
	}
}
