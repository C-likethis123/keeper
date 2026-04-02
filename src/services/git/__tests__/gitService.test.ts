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

let appStateHandler: ((state: string) => void) | undefined;

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
}

describe("GitService", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		jest.clearAllMocks();
		jest.spyOn(console, "warn").mockImplementation(() => {});
		appStateHandler = undefined;

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
		mockAddEventListener.mockImplementation((_event, handler) => {
			appStateHandler = handler;
			return { remove: jest.fn() };
		});

		jest.doMock("react-native", () => ({
			AppState: {
				addEventListener: mockAddEventListener,
			},
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

	it("flushes queued changes immediately and cancels the debounce timer", async () => {
		const { GitService } = await import("../gitService");

		GitService.queueChange("note-1.md", "modify");
		GitService.scheduleCommitBatch(5000);

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
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

		GitService.queueChange("note-1.md", "modify");

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
		});
		await expect(secondFlush).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
		});
	});

	it("re-queues pending changes after a failed push so the next flush can retry", async () => {
		const { GitService } = await import("../gitService");
		mockPush.mockRejectedValueOnce(new Error("offline"));

		GitService.queueChange("note-1.md", "modify");

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: false,
			didCommit: true,
			didPush: false,
			error: "offline",
		});

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: true,
			didPush: true,
		});

		expect(mockCommit).toHaveBeenCalledTimes(2);
		expect(mockPush).toHaveBeenCalledTimes(2);
	});

	it("returns a no-op success result when there are no queued changes", async () => {
		const { GitService } = await import("../gitService");

		await expect(
			GitService.flushPendingChanges({ reason: "note-exit" }),
		).resolves.toEqual({
			success: true,
			didCommit: false,
			didPush: false,
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
		GitService.queueChange("note-1.md", "modify");

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
});
