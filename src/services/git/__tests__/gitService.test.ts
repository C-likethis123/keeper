const mockStatus = jest.fn();
const mockCommit = jest.fn();
const mockPush = jest.fn();
const mockFetch = jest.fn();
const mockCheckout = jest.fn();
const mockCurrentBranch = jest.fn();
const mockListBranches = jest.fn();
const mockMerge = jest.fn();
const mockResolveHeadOid = jest.fn();
const mockChangedMarkdownPaths = jest.fn();
const mockAddEventListener = jest.fn();
const mockStorageSaveNote = jest.fn();
const mockStorageDeleteNote = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();

let appStateHandler: ((state: string) => void) | undefined;
let asyncStorageState = new Map<string, string>();

function createDeferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

describe("GitService", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		jest.clearAllMocks();
		jest.spyOn(console, "warn").mockImplementation(() => {});
		appStateHandler = undefined;
		asyncStorageState = new Map();

		mockStatus.mockResolvedValue([{ path: "note-1.md", status: "modified" }]);
		mockCommit.mockResolvedValue(undefined);
		mockPush.mockResolvedValue(undefined);
		mockFetch.mockResolvedValue(undefined);
		mockCheckout.mockResolvedValue(undefined);
		mockCurrentBranch.mockResolvedValue("main");
		mockListBranches.mockResolvedValue(["main"]);
		mockMerge.mockResolvedValue(undefined);
		mockResolveHeadOid.mockResolvedValue("abc123");
		mockChangedMarkdownPaths.mockResolvedValue({
			added: [],
			modified: [],
			deleted: [],
		});
		mockStorageSaveNote.mockImplementation(async (note) => ({
			...note,
			lastUpdated: 1000,
		}));
		mockStorageDeleteNote.mockResolvedValue(true);
		mockAddEventListener.mockImplementation((_event, handler) => {
			appStateHandler = handler;
			return { remove: jest.fn() };
		});

		jest.doMock("react-native", () => ({
			AppState: {
				addEventListener: mockAddEventListener,
			},
		}));

		jest.doMock("@react-native-async-storage/async-storage", () => ({
			__esModule: true,
			default: {
				getItem: jest.fn(async (key: string) => asyncStorageState.get(key) ?? null),
				setItem: jest.fn(async (key: string, value: string) => {
					asyncStorageState.set(key, value);
				}),
				removeItem: jest.fn(async (key: string) => {
					asyncStorageState.delete(key);
				}),
			},
		}));

		jest.doMock("@/services/storage/storageEngine", () => ({
			getStorageEngine: () => ({
				saveNote: (...args: unknown[]) => mockStorageSaveNote(...args),
				deleteNote: (...args: unknown[]) => mockStorageDeleteNote(...args),
			}),
		}));

		jest.doMock("@/services/notes/notesIndex", () => ({
			NotesIndexService: {
				upsertNote: (...args: unknown[]) => mockIndexUpsert(...args),
				deleteNote: (...args: unknown[]) => mockIndexDelete(...args),
			},
			extractSummary: (content: string) => content.slice(0, 50),
		}));

		jest.doMock("../gitEngine", () => ({
			getGitEngine: () => ({
				clone: jest.fn(),
				fetch: mockFetch,
				checkout: mockCheckout,
				currentBranch: mockCurrentBranch,
				listBranches: mockListBranches,
				merge: mockMerge,
				commit: mockCommit,
				push: mockPush,
				status: mockStatus,
				resolveHeadOid: mockResolveHeadOid,
				changedMarkdownPaths: mockChangedMarkdownPaths,
			}),
		}));
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("flushes journaled changes immediately and cancels the debounce timer", async () => {
		const { GitService } = await import("../gitService");

		await GitService.queueChangeAsync("note-1.md", "modify");
		GitService.scheduleCommitBatch(5000);

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
			didRecover: false,
		});

		expect(mockCommit).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(5000);
		await flushMicrotasks();

		expect(mockCommit).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	it("shares one in-flight flush across concurrent callers", async () => {
		const { GitService } = await import("../gitService");
		const pushDeferred = createDeferred<void>();
		mockPush.mockReturnValue(pushDeferred.promise);

		await GitService.queueChangeAsync("note-1.md", "modify");

		const firstFlush = GitService.flushPendingChanges({ reason: "note-exit" });
		const secondFlush = GitService.flushPendingChanges({ reason: "delete" });
		await flushMicrotasks();

		expect(mockCommit).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(1);

		pushDeferred.resolve();

		await expect(firstFlush).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
			didRecover: false,
		});
		await expect(secondFlush).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
			didRecover: false,
		});
	});

	it("keeps the journal after a failed push so the next flush can retry", async () => {
		const { GitService } = await import("../gitService");
		mockStatus
			.mockResolvedValueOnce([{ path: "note-1.md", status: "modified" }])
			.mockResolvedValueOnce([]);
		mockPush.mockRejectedValueOnce(new Error("offline"));

		await GitService.queueChangeAsync("note-1.md", "modify");

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: false,
			didCommit: true,
			didPush: false,
			error: "offline",
			didRecover: false,
		});

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: false,
			didPush: true,
			didRecover: false,
		});

		expect(mockCommit).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(2);
	});

	it("returns a no-op success result when the journal is empty", async () => {
		const { GitService } = await import("../gitService");

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: false,
			didPush: false,
			didRecover: false,
		});

		expect(mockStatus).not.toHaveBeenCalled();
		expect(mockCommit).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("persists through the registered background save handler before pushing on app background", async () => {
		const { GitService } = await import("../gitService");
		const saveDeferred = createDeferred<void>();
		const backgroundSave = jest.fn(() => saveDeferred.promise);

		GitService.registerBackgroundSaveHandler(backgroundSave);
		await GitService.queueChangeAsync("note-1.md", "modify");

		expect(appStateHandler).toBeDefined();

		appStateHandler?.("background");
		await flushMicrotasks();

		expect(backgroundSave).toHaveBeenCalledTimes(1);
		expect(mockPush).not.toHaveBeenCalled();

		saveDeferred.resolve();
		await flushMicrotasks();

		expect(mockCommit).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	it("replays journaled note snapshots during recovery and clears the journal after push", async () => {
		const { GitService } = await import("../gitService");
		mockStatus.mockResolvedValue([{ path: "note-1.md", status: "modified" }]);

		await GitService.queueChangeAsync("note-1.md", "modify", {
			id: "note-1",
			title: "Recovered",
			content: "body",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await expect(GitService.recoverPendingChanges()).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
			didRecover: true,
		});

		expect(mockStorageSaveNote).toHaveBeenCalledWith({
			id: "note-1",
			title: "Recovered",
			content: "body",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		expect(mockIndexUpsert).toHaveBeenCalledWith({
			noteId: "note-1",
			summary: "body",
			title: "Recovered",
			isPinned: false,
			updatedAt: 1000,
			noteType: "note",
			status: null,
		});

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: false,
			didPush: false,
			didRecover: false,
		});
	});

	it("cleans the working tree before remote sync when a journal exists", async () => {
		const { GitService } = await import("../gitService");

		await GitService.queueChangeAsync("note-1.md", "modify", {
			id: "note-1",
			title: "Recovered",
			content: "body",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await GitService.prepareRecoveryForRemoteSync();

		expect(mockCheckout).toHaveBeenCalledWith(expect.any(String), "HEAD", {
			noUpdateHead: true,
			force: true,
		});
	});
});
