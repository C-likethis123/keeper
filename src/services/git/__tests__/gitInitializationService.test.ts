import type { GitInitDependencies } from "@/services/git/init/types";

const mockRecoverPendingChanges = jest.fn();
const mockWithGitLock = jest.fn((task: () => Promise<unknown>) => task());

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		recoverPendingChanges: (...args: unknown[]) =>
			mockRecoverPendingChanges(...args),
		withGitLock: (...args: unknown[]) => mockWithGitLock(...args),
	},
}));

jest.mock("@/services/storage/storageEngine", () => ({
	getStorageEngine: () => ({
		resetAllData: jest.fn(),
	}),
}));

jest.mock("@/services/notes/Notes", () => ({
	NOTES_ROOT: "/tmp/keeper-notes",
}));

import { GitInitializationService } from "../gitInitializationService";

describe("GitInitializationService", () => {
	const serviceState = () =>
		GitInitializationService.instance as unknown as {
			dependencies: GitInitDependencies | null;
			_config: unknown;
		};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, "log").mockImplementation(() => {});
		jest.spyOn(console, "warn").mockImplementation(() => {});
		jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		serviceState().dependencies = null;
		serviceState()._config = null;
		jest.restoreAllMocks();
	});

	it("recovers newer local journal content before remote pull sync starts", async () => {
		const order: string[] = [];
		const dependencies = {
			stateStore: {
				shouldForceRepoReset: jest.fn().mockResolvedValue(false),
				clearForceRepoResetFlag: jest.fn(),
				readPendingJournal: jest.fn().mockResolvedValue([
					{
						filePath: "note-1.md",
						operation: "modify",
						updatedAt: 100,
						note: {
							id: "note-1",
							title: "Local newer",
							content: "newer local body",
							isPinned: false,
							noteType: "note",
							status: null,
						},
					},
				]),
				writeLastSyncedOid: jest.fn(),
			},
			repoBootstrapper: {
				validateRepository: jest.fn().mockResolvedValue({
					exists: true,
					isValid: true,
				}),
				cloneRepository: jest.fn(),
			},
			gitEngine: {
				resolveHeadOid: jest.fn().mockResolvedValue("recovered-head"),
			},
			remoteSyncService: {
				syncWithRemote: jest.fn().mockImplementation(async () => {
					order.push("remote-sync");
					return {
						success: true,
						metrics: {
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
							usedFastForward: false,
							didHeadChange: false,
							didDbSync: false,
						},
					};
				}),
			},
			dbSyncService: {},
			mainReconcileService: {},
		} as unknown as GitInitDependencies;

		mockRecoverPendingChanges.mockImplementation(async () => {
			order.push("recover-local");
			return {
				success: true,
				didCommit: true,
				didPush: true,
			};
		});

		(
			GitInitializationService.instance as unknown as {
				dependencies: GitInitDependencies;
			}
		).dependencies = dependencies;

		const result = await GitInitializationService.instance.initialize();

		expect(result.success).toBe(true);
		expect(order).toEqual(["recover-local", "remote-sync"]);
		expect(dependencies.remoteSyncService.syncWithRemote).toHaveBeenCalledTimes(1);
		expect(dependencies.stateStore.writeLastSyncedOid).toHaveBeenCalledWith(
			"recovered-head",
		);
	});
});
