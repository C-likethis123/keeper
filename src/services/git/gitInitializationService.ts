import { NOTES_ROOT } from "@/services/notes/Notes";
import { parseFrontmatter } from "@/services/notes/frontmatter";
import { NoteService } from "@/services/notes/noteService";
import {
	type StartupTelemetry,
	createNoopStartupTelemetry,
} from "@/services/startup/startupTelemetry";
import { getStorageEngine } from "@/services/storage/storageEngine";
import type { GitConflictFile } from "./engines/GitEngine";
import { getGitEngine } from "./gitEngine";
import { GitService } from "./gitService";
import { DefaultDbSyncService } from "./init/dbSyncService";
import { DefaultGitInitErrorMapper } from "./init/errorMapper";
import { DefaultMainReconcileService } from "./init/mainReconcileService";
import { DefaultRemoteSyncService } from "./init/remoteSyncService";
import { DefaultRepoBootstrapper } from "./init/repoBootstrapper";
import { AsyncGitSyncStateStore } from "./init/stateStore";
import {
	type GitHubConfig,
	type GitInitDependencies,
	type InitializationResult,
	type InitializeOptions,
	type RemoteSyncMetrics,
	createEmptyStartupMetrics,
} from "./init/types";
import { getGitRuntimeSupport } from "./runtime";

async function createSyncConflictNotes(
	conflicts: GitConflictFile[],
): Promise<void> {
	for (const conflict of conflicts) {
		if (!conflict.theirsContent) continue;
		const baseName = conflict.path.replace(/\.md$/, "");
		const conflictId = `${baseName}-sync_conflict`;
		try {
			const parsed = parseFrontmatter(conflict.theirsContent);
			const title = parsed.title
				? `${parsed.title} (sync conflict)`
				: `${baseName} (sync conflict)`;
			await NoteService.saveNote(
				{
					id: conflictId,
					title,
					content: parsed.content,
					isPinned: false,
					noteType: parsed.noteType ?? "note",
					status: parsed.status ?? null,
					createdAt: parsed.createdAt ?? Date.now(),
					completedAt: parsed.completedAt ?? null,
					attachment: parsed.attachment ?? null,
					attachedVideo: parsed.attachedVideo ?? null,
					resourceUrl: parsed.resourceUrl ?? null,
					documentPositions: parsed.documentPositions ?? null,
				},
				true,
			);
			console.log(
				`[GitInitializationService] Created sync conflict note: ${conflictId}`,
			);
		} catch (err) {
			console.warn(
				`[GitInitializationService] Failed to create sync conflict note for ${conflict.path}:`,
				err,
			);
		}
	}
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

function createGitInitDependencies(config: GitHubConfig): GitInitDependencies {
	const gitEngine = getGitEngine();
	const stateStore = new AsyncGitSyncStateStore();
	const errorMapper = new DefaultGitInitErrorMapper();
	const repoBootstrapper = new DefaultRepoBootstrapper(
		gitEngine,
		config,
		errorMapper,
	);
	const dbSyncService = new DefaultDbSyncService(gitEngine, stateStore);
	const mainReconcileService = new DefaultMainReconcileService(
		gitEngine,
		stateStore,
	);
	const remoteSyncService = new DefaultRemoteSyncService(
		gitEngine,
		dbSyncService,
		stateStore,
	);

	return {
		gitEngine,
		stateStore,
		repoBootstrapper,
		dbSyncService,
		remoteSyncService,
		mainReconcileService,
	};
}

export class GitInitializationService {
	static readonly instance = new GitInitializationService();
	private _config: GitHubConfig | null = null;
	private dependencies: GitInitDependencies | null = null;

	private constructor() {}

	private get config(): GitHubConfig {
		if (!this._config) {
			this._config = assertGitHubConfig();
		}
		return this._config;
	}

	private ensureDependencies(): GitInitDependencies {
		if (this.dependencies) {
			return this.dependencies;
		}
		this.dependencies = createGitInitDependencies(this.config);
		return this.dependencies;
	}

	private applySyncMetrics(
		target: InitializationResult["metrics"],
		source: RemoteSyncMetrics,
	): void {
		Object.assign(target, source);
	}

	async initialize(
		options: InitializeOptions = {},
	): Promise<InitializationResult> {
		const initStart = performance.now();
		const metrics = createEmptyStartupMetrics();
		const telemetry: StartupTelemetry =
			options.telemetry ?? createNoopStartupTelemetry("git-initialization");
		console.log("[GitInitializationService] Starting initialization...");

		try {
			let dependencies: GitInitDependencies;
			try {
				dependencies = this.ensureDependencies();
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown engine error";
				return {
					success: false,
					wasCloned: false,
					supported: true,
					error: `Rust git unavailable: ${errorMsg}`,
					metrics,
				};
			}

			if (await dependencies.stateStore.shouldForceRepoReset()) {
				await getStorageEngine().resetAllData();
				await dependencies.stateStore.clearForceRepoResetFlag();
			}

			const hasPendingJournal = await dependencies.stateStore
				.readPendingJournal()
				.then((entries) => entries.length > 0);

			const runtimeSupport = getGitRuntimeSupport();
			if (!runtimeSupport.supported) {
				telemetry.trace("git.runtime_unsupported", {
					reason: runtimeSupport.reason,
				});
				return {
					success: true,
					wasCloned: false,
					supported: false,
					reason: runtimeSupport.reason,
					metrics,
				};
			}

			console.log(
				"[GitInitializationService] Checking if local repository exists and is valid...",
			);
			const tValidate = performance.now();
			const repoValidation =
				await dependencies.repoBootstrapper.validateRepository();
			metrics.validateRepoMs = Math.round(performance.now() - tValidate);
			telemetry.trace("git.repository_validation", {
				exists: repoValidation.exists,
				isValid: repoValidation.isValid,
				reason: repoValidation.reason,
				durationMs: metrics.validateRepoMs,
			});
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
						supported: true,
						error:
							"Invalid repository detected, please clear your cache manually and try again",
						metrics,
					};
				}

				console.log("[GitInitializationService] Starting fresh clone...");
				const cloneStart = performance.now();
				const cloneResult =
					await dependencies.repoBootstrapper.cloneRepository();
				telemetry.trace("git.clone_completed", {
					success: cloneResult.success,
					durationMs: Math.round(performance.now() - cloneStart),
				});
				if (!cloneResult.success) {
					const error =
						cloneResult.failureMessage ??
						"Failed to clone repository. Check network connection and repository access permissions";
					console.error(`[GitInitializationService] ${error}`);
					return {
						success: false,
						wasCloned: false,
						supported: true,
						error,
						metrics,
					};
				}
				if (hasPendingJournal) {
					const recoveryResult = await GitService.recoverPendingChanges();
					if (!recoveryResult.success) {
						console.warn(
							"[GitInitializationService] Recovery push after clone failed:",
							recoveryResult.error,
						);
					}
					if (recoveryResult.didPush) {
						const recoveredHead =
							await dependencies.gitEngine.resolveHeadOid(NOTES_ROOT);
						await dependencies.stateStore.writeLastSyncedOid(recoveredHead);
					}
				}
				return {
					success: true,
					wasCloned: true,
					supported: true,
					metrics,
				};
			}

			console.log(
				"[GitInitializationService] Valid repository already exists, skipping clone",
			);
			if (hasPendingJournal) {
				const recoveryResult = await GitService.recoverPendingChanges();
				if (!recoveryResult.success) {
					console.warn(
						"[GitInitializationService] Recovery push before sync failed:",
						recoveryResult.error,
					);
					return {
						success: true,
						wasCloned: false,
						supported: true,
						error: recoveryResult.error,
						metrics,
					};
				}
				if (recoveryResult.didPush) {
					const recoveredHead =
						await dependencies.gitEngine.resolveHeadOid(NOTES_ROOT);
					await dependencies.stateStore.writeLastSyncedOid(recoveredHead);
				}
			}
			const syncResult = await GitService.withGitLock(() =>
				dependencies.remoteSyncService.syncWithRemote(telemetry),
			);
			this.applySyncMetrics(metrics, syncResult.metrics);

			if (syncResult.success) {
				// Create sync_conflict notes for any files that had merge conflicts
				if (syncResult.conflicts && syncResult.conflicts.length > 0) {
					await createSyncConflictNotes(syncResult.conflicts);
				}

				console.log(
					"[GitInitializationService] Successfully synced with remote",
				);
				return {
					success: true,
					wasCloned: false,
					supported: true,
					metrics,
				};
			}
			console.warn(
				"[GitInitializationService] Failed to sync with remote:",
				syncResult.error,
			);
			if (hasPendingJournal) {
				await GitService.restorePendingChangesFromJournal();
			}
			return {
				success: true,
				wasCloned: false,
				supported: true,
				error: syncResult.error,
				metrics,
			};
		} catch (error) {
			return {
				success: false,
				wasCloned: false,
				supported: true,
				error: error instanceof Error ? error.message : String(error),
				metrics,
			};
		} finally {
			metrics.totalMs = Math.round(performance.now() - initStart);
			telemetry.trace("git.initialize_metrics", { ...metrics });
			console.log("[GitInitializationService] Startup metrics", metrics);
		}
	}
}
