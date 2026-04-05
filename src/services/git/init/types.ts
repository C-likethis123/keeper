import type { GitEngine } from "@/services/git/engines/GitEngine";
import type { NoteSaveInput } from "@/services/notes/types";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";

export interface GitHubConfig {
	owner: string;
	repo: string;
	token: string;
}

export interface InitializeOptions {
	telemetry?: StartupTelemetry;
}

export interface StartupMetrics {
	validateRepoMs: number;
	fetchMs: number;
	resolveHeadBeforeMs: number;
	resolveHeadAfterMs: number;
	branchResolveMs: number;
	remoteBranchListMs: number;
	currentBranchResolveMs: number;
	mergeMs: number;
	fastForwardMergeMs: number;
	regularMergeMs: number;
	checkoutMs: number;
	dbSyncMs: number;
	readLastSyncedOidMs: number;
	writeLastSyncedOidMs: number;
	changedPathsMs: number;
	indexSyncMs: number;
	totalMs: number;
	usedFastForward: boolean;
	didHeadChange: boolean;
	didDbSync: boolean;
}

export interface InitializationResult {
	success: boolean;
	wasCloned: boolean;
	supported: boolean;
	error?: string;
	reason?: string;
	metrics: StartupMetrics;
}

export type RemoteSyncMetrics = Omit<
	StartupMetrics,
	"validateRepoMs" | "totalMs"
>;

export interface SyncWithRemoteResult {
	success: boolean;
	error?: string;
	metrics: RemoteSyncMetrics;
}

export type GitJournalOperation = "add" | "modify" | "delete";

export interface GitJournalEntry {
	filePath: string;
	operation: GitJournalOperation;
	note?: NoteSaveInput;
	updatedAt: number;
}

export interface SyncDbAfterPullResult {
	didDbSync: boolean;
	dbSyncMs: number;
	readLastSyncedOidMs: number;
	writeLastSyncedOidMs: number;
	changedPathsMs: number;
	indexSyncMs: number;
}

export interface RepositoryValidationResult {
	exists: boolean;
	isValid: boolean;
	reason?: string;
}

export interface CloneRepositoryResult {
	success: boolean;
	failureMessage?: string;
}

export interface GitSyncStateStore {
	readLastSyncedOid(): Promise<string | undefined>;
	writeLastSyncedOid(oid: string): Promise<void>;
	shouldForceRepoReset(): Promise<boolean>;
	clearForceRepoResetFlag(): Promise<void>;
	readPendingJournal(): Promise<GitJournalEntry[]>;
	writePendingJournal(entries: GitJournalEntry[]): Promise<void>;
}

export interface RepoBootstrapper {
	validateRepository(): Promise<RepositoryValidationResult>;
	cloneRepository(): Promise<CloneRepositoryResult>;
}

export interface RemoteSyncService {
	syncWithRemote(telemetry: StartupTelemetry): Promise<SyncWithRemoteResult>;
}

export interface DbSyncService {
	syncDbAfterPull(
		currentOid: string | undefined,
		telemetry: StartupTelemetry,
	): Promise<SyncDbAfterPullResult>;
}

export interface CloneErrorResolution {
	failureMessage?: string;
}

export interface GitInitErrorMapper {
	resolveCloneFailure(error: unknown): Promise<CloneErrorResolution>;
}

export function createEmptyStartupMetrics(): StartupMetrics {
	return {
		validateRepoMs: 0,
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
		totalMs: 0,
		usedFastForward: false,
		didHeadChange: false,
		didDbSync: false,
	};
}

export interface GitInitDependencies {
	gitEngine: GitEngine;
	stateStore: GitSyncStateStore;
	repoBootstrapper: RepoBootstrapper;
	dbSyncService: DbSyncService;
	remoteSyncService: RemoteSyncService;
}
