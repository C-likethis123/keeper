import {
	type StartupTelemetry,
	createNoopStartupTelemetry,
} from "@/services/startup/startupTelemetry";
import { getStorageEngine } from "@/services/storage/storageEngine";
import { getGitEngine } from "./gitEngine";
import { DefaultDbSyncService } from "./init/dbSyncService";
import { DefaultGitInitErrorMapper } from "./init/errorMapper";
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
	};
}

export class GitInitializationService {
	static readonly instance = new GitInitializationService();
	private readonly config = assertGitHubConfig();
	private dependencies: GitInitDependencies | null = null;

	private constructor() {}

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
		target.fetchMs = source.fetchMs;
		target.resolveHeadBeforeMs = source.resolveHeadBeforeMs;
		target.resolveHeadAfterMs = source.resolveHeadAfterMs;
		target.branchResolveMs = source.branchResolveMs;
		target.remoteBranchListMs = source.remoteBranchListMs;
		target.currentBranchResolveMs = source.currentBranchResolveMs;
		target.mergeMs = source.mergeMs;
		target.fastForwardMergeMs = source.fastForwardMergeMs;
		target.regularMergeMs = source.regularMergeMs;
		target.checkoutMs = source.checkoutMs;
		target.dbSyncMs = source.dbSyncMs;
		target.readLastSyncedOidMs = source.readLastSyncedOidMs;
		target.writeLastSyncedOidMs = source.writeLastSyncedOidMs;
		target.changedPathsMs = source.changedPathsMs;
		target.indexSyncMs = source.indexSyncMs;
		target.usedFastForward = source.usedFastForward;
		target.didHeadChange = source.didHeadChange;
		target.didDbSync = source.didDbSync;
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
						"[GitInitializationService] Invalid/partial repository detected, cleaning up and re-cloning...",
					);
					await getStorageEngine().resetAllData();
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
			const syncResult =
				await dependencies.remoteSyncService.syncWithRemote(telemetry);
			this.applySyncMetrics(metrics, syncResult.metrics);

			if (syncResult.success) {
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
			return {
				success: true,
				wasCloned: false,
				supported: true,
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
