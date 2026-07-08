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
		readPendingJournal: jest.fn().mockResolvedValue([]),
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

	it("discards unjournaled dirty notes before merging remote state", async () => {
		const order: string[] = [];
		const gitEngine = createGitEngine({
			status: jest.fn().mockResolvedValue([{ path: "note-1.md" }]),
			checkout: jest.fn().mockImplementation(async () => {
				order.push("discard-local");
			}),
			merge: jest.fn().mockImplementation(async () => {
				order.push("merge-remote");
			}),
		});
		const service = new DefaultRemoteSyncService(
			gitEngine,
			createDbSyncService(),
			createStateStore(),
		);

		await service.syncWithRemote(createNoopStartupTelemetry());

		expect(gitEngine.commit).not.toHaveBeenCalled();
		expect(gitEngine.checkout).toHaveBeenCalledWith("/tmp/keeper-notes", "HEAD", {
			noUpdateHead: true,
			force: true,
		});
		expect(order).toEqual(["discard-local", "merge-remote", "discard-local"]);
	});

	it("commits journaled dirty notes before merging remote state", async () => {
		const order: string[] = [];
		const gitEngine = createGitEngine({
			status: jest.fn().mockResolvedValue([{ path: "note-1.md" }]),
			commit: jest.fn().mockImplementation(async () => {
				order.push("commit-local");
			}),
			merge: jest.fn().mockImplementation(async () => {
				order.push("merge-remote");
			}),
		});
		const stateStore = createStateStore();
		(stateStore.readPendingJournal as jest.Mock).mockResolvedValue([
			{ filePath: "note-1.md", operation: "modify", updatedAt: 1 },
		]);
		const service = new DefaultRemoteSyncService(
			gitEngine,
			createDbSyncService(),
			stateStore,
		);

		await service.syncWithRemote(createNoopStartupTelemetry());

		expect(gitEngine.commit).toHaveBeenCalledWith(
			"/tmp/keeper-notes",
			"Auto-save before sync",
		);
		expect(order).toEqual(["commit-local", "merge-remote"]);
	});
});
