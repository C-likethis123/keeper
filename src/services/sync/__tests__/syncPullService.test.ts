const mockAsyncStorage = new Map<string, string>();
const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();
const mockDeleteCrdtNote = jest.fn();
const mockBumpContentVersion = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: jest.fn((key: string) =>
			Promise.resolve(mockAsyncStorage.get(key) ?? null),
		),
		setItem: jest.fn((key: string, value: string) => {
			mockAsyncStorage.set(key, value);
			return Promise.resolve();
		}),
	},
}));

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
		loadNote: jest.fn(),
	},
}));

jest.mock("@/services/notes/notesIndex", () => ({
	extractSummary: (content: string) => content,
	NotesIndexService: {
		upsertNote: (...args: unknown[]) => mockIndexUpsert(...args),
		deleteNote: (...args: unknown[]) => mockIndexDelete(...args),
	},
}));

jest.mock("@/services/notes/crdtNoteService", () => ({
	deleteCrdtNote: (...args: unknown[]) => mockDeleteCrdtNote(...args),
}));

jest.mock("@/services/notes/noteQueryCache", () => ({
	invalidateNoteQueryCache: jest.fn(),
}));

jest.mock("@/stores/storageStore", () => ({
	useStorageStore: {
		getState: () => ({ bumpContentVersion: mockBumpContentVersion }),
	},
}));

describe("syncPullService", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
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
		const fetchMock = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						cursor: 2,
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

		const { pullPendingSyncOps } = await import(
			"@/services/sync/syncPullService"
		);

		await pullPendingSyncOps();

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
		expect(mockBumpContentVersion).toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
