import { vi } from "vitest";
const {
	mockAsyncStorage,
	mockSaveNote,
	mockDeleteNote,
	mockIndexUpsert,
	mockIndexDelete,
	mockDeleteCrdtNote,
	mockBumpContentVersion,
} = vi.hoisted(() => ({
	mockAsyncStorage: new Map<string, string>(),
	mockSaveNote: vi.fn(),
	mockDeleteNote: vi.fn(),
	mockIndexUpsert: vi.fn(),
	mockIndexDelete: vi.fn(),
	mockDeleteCrdtNote: vi.fn(),
	mockBumpContentVersion: vi.fn(),
}));

vi.mock("@/services/storage/browserKeyValueStorage", () => ({
	default: {
		getItem: vi.fn((key: string) =>
			Promise.resolve(mockAsyncStorage.get(key) ?? null),
		),
		setItem: vi.fn((key: string, value: string) => {
			mockAsyncStorage.set(key, value);
			return Promise.resolve();
		}),
	},
}));

vi.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
		loadNote: vi.fn(),
	},
}));

vi.mock("@/services/notes/notesIndex", () => ({
	extractSummary: (content: string) => content,
	NotesIndexService: {
		upsertNote: (...args: unknown[]) => mockIndexUpsert(...args),
		deleteNote: (...args: unknown[]) => mockIndexDelete(...args),
	},
}));

vi.mock("@/services/notes/crdtNoteService", () => ({
	deleteCrdtNote: (...args: unknown[]) => mockDeleteCrdtNote(...args),
}));

vi.mock("@/stores/storageStore", () => ({
	useStorageStore: {
		getState: () => ({ bumpContentVersion: mockBumpContentVersion }),
	},
}));

describe("syncPullService", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockAsyncStorage.clear();
		process.env.EXPO_PUBLIC_SYNC_SERVER_URL = "https://sync.example";
		mockSaveNote.mockImplementation((note) =>
			Promise.resolve({
				...note,
				lastUpdated: 1000,
				status: note.status ?? null,
			}),
		);
		mockDeleteNote.mockResolvedValue(true);
		mockIndexUpsert.mockResolvedValue(undefined);
		mockIndexDelete.mockResolvedValue(undefined);
		mockDeleteCrdtNote.mockResolvedValue(undefined);
	});

	afterEach(() => {
		process.env.EXPO_PUBLIC_SYNC_SERVER_URL = undefined;
	});

	it("applies remote create and delete operations and advances cursor", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						cursor: 1,
						ops: [
							{
								serverId: 1,
								deviceId: "phone",
								opId: "phone:1",
								seq: 1,
								type: "note.create",
								noteId: "note-1",
								path: "note-1.md",
								title: "Inbox",
								markdown:
									'---\npinned: false\ntitle: "Inbox"\nid: "note-1"\ntype: "note"\n---\nBody',
								createdAt: "2026-07-11T10:00:00.000Z",
							},
						],
					}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						cursor: 2,
						ops: [
							{
								serverId: 2,
								deviceId: "phone",
								opId: "phone:2",
								seq: 2,
								type: "note.delete",
								noteId: "note-1",
								deletedAt: "2026-07-11T10:01:00.000Z",
							},
						],
					}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ cursor: 2, ops: [] }),
			});
		global.fetch = fetchMock as typeof fetch;

		const { pullPendingSyncOps, stopSyncPullService } = await import(
			"@/services/sync/syncPullService"
		);

		await pullPendingSyncOps();
		stopSyncPullService();

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				title: "Inbox",
				content: "Body",
				isPinned: false,
				noteType: "note",
			}),
		);
		expect(mockDeleteCrdtNote).toHaveBeenCalledWith("note-1");
		expect(mockDeleteNote).toHaveBeenCalledWith("note-1");
		expect(mockIndexDelete).toHaveBeenCalledWith("note-1");
		expect(mockAsyncStorage.get("keeper:sync:pull-cursor")).toBe("2");
		expect(mockBumpContentVersion).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
