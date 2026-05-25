import type { GitEngine } from "@/services/git/engines/GitEngine";
import { DefaultRemoteSyncService } from "@/services/git/init/remoteSyncService";
import type {
	DbSyncService,
	GitSyncStateStore,
} from "@/services/git/init/types";
import { createNoopStartupTelemetry } from "@/services/startup/startupTelemetry";

jest.mock("@/services/notes/Notes", () => ({
	NOTES_ROOT: "/tmp/keeper-notes",
}));

function createGitEngine(overrides: Partial<GitEngine> = {}): GitEngine {
	return {
		clone: jest.fn(),
		fetch: jest.fn().mockResolvedValue(undefined),
		checkout: jest.fn().mockResolvedValue(undefined),
		currentBranch: jest.fn().mockResolvedValue("main"),
		listBranches: jest.fn().mockResolvedValue(["main"]),
		createBranch: jest.fn(),
		merge: jest.fn().mockResolvedValue(undefined),
		commit: jest.fn(),
		push: jest.fn(),
		status: jest.fn().mockResolvedValue([]),
		resolveHeadOid: jest
			.fn()
			.mockResolvedValueOnce("before-oid")
			.mockResolvedValueOnce("after-oid"),
		changedMarkdownPaths: jest.fn(),
		changedPaths: jest.fn(),
		getConflictedFiles: jest.fn(),
		resolveConflict: jest.fn(),
		hasUnresolvedConflicts: jest.fn(),
		...overrides,
	} as unknown as GitEngine;
}

function createDbSyncService(): DbSyncService {
	return {
		syncDbAfterPull: jest.fn().mockResolvedValue({
			didDbSync: false,
			didImportClusters: false,
			dbSyncMs: 0,
			readLastSyncedOidMs: 0,
			writeLastSyncedOidMs: 0,
			changedPathsMs: 0,
			indexSyncMs: 0,
		}),
	};
}

function createStateStore(): GitSyncStateStore {
	return {
		readLastSyncedOid: jest.fn(),
		writeLastSyncedOid: jest.fn(),
		shouldForceRepoReset: jest.fn(),
		clearForceRepoResetFlag: jest.fn(),
		readPendingJournal: jest.fn(),
		writePendingJournal: jest.fn(),
		readDeviceId: jest.fn(),
		writeDeviceId: jest.fn(),
	};
}

describe("DefaultRemoteSyncService", () => {
	it("merges the current branch when it exists on origin", async () => {
		const gitEngine = createGitEngine({
			currentBranch: jest.fn().mockResolvedValue("device/desktop-3103fcbf"),
			listBranches: jest
				.fn()
				.mockResolvedValue(["main", "device/desktop-3103fcbf"]),
		});
		const service = new DefaultRemoteSyncService(
			gitEngine,
			createDbSyncService(),
			createStateStore(),
		);

		await service.syncWithRemote(createNoopStartupTelemetry());

		expect(gitEngine.merge).toHaveBeenCalledWith("/tmp/keeper-notes", {
			ours: "device/desktop-3103fcbf",
			theirs: "origin/device/desktop-3103fcbf",
			fastForwardOnly: true,
		});
	});

	it("keeps the current branch as ours when only origin/main exists", async () => {
		const gitEngine = createGitEngine({
			currentBranch: jest.fn().mockResolvedValue("device/local-only"),
			listBranches: jest.fn().mockResolvedValue(["main"]),
		});
		const service = new DefaultRemoteSyncService(
			gitEngine,
			createDbSyncService(),
			createStateStore(),
		);

		await service.syncWithRemote(createNoopStartupTelemetry());

		expect(gitEngine.merge).toHaveBeenCalledWith("/tmp/keeper-notes", {
			ours: "device/local-only",
			theirs: "origin/main",
			fastForwardOnly: true,
		});
	});
});
