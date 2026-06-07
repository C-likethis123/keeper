import { GitJournal } from "../gitJournal";
import type { GitJournalEntry, GitSyncStateStore } from "../init/types";

const mockStorageSaveNote = jest.fn();
const mockStorageDeleteNote = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();

class MemoryGitSyncStateStore implements GitSyncStateStore {
	journal: GitJournalEntry[] = [];

	async readLastSyncedOid(): Promise<string | undefined> {
		return undefined;
	}

	async writeLastSyncedOid(): Promise<void> {}

	async shouldForceRepoReset(): Promise<boolean> {
		return false;
	}

	async clearForceRepoResetFlag(): Promise<void> {}

	async readPendingJournal(): Promise<GitJournalEntry[]> {
		return this.journal;
	}

	async writePendingJournal(entries: GitJournalEntry[]): Promise<void> {
		this.journal = entries;
	}

	async readDeviceId(): Promise<string | undefined> {
		return undefined;
	}

	async writeDeviceId(): Promise<void> {}
}

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		saveNote: (...args: unknown[]) => mockStorageSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockStorageDeleteNote(...args),
	},
}));

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		upsertNote: (...args: unknown[]) => mockIndexUpsert(...args),
		deleteNote: (...args: unknown[]) => mockIndexDelete(...args),
	},
	extractSummary: (content: string) => content.slice(0, 50),
}));

describe("GitJournal", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(Date, "now").mockReturnValue(100);
		mockStorageSaveNote.mockImplementation(async (note) => ({
			...note,
			lastUpdated: 200,
		}));
		mockStorageDeleteNote.mockResolvedValue(true);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("coalesces redundant add, modify, and delete operations", async () => {
		const stateStore = new MemoryGitSyncStateStore();
		const journal = new GitJournal(stateStore);

		await journal.queueChange("new.md", "add", {
			id: "new",
			title: "New",
			content: "draft",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		jest.spyOn(Date, "now").mockReturnValue(101);
		await journal.queueChange("new.md", "modify", {
			id: "new",
			title: "New",
			content: "updated",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		expect(stateStore.journal).toEqual([
			expect.objectContaining({
				filePath: "new.md",
				operation: "add",
				updatedAt: 101,
				note: expect.objectContaining({ content: "updated" }),
			}),
		]);

		await journal.queueChange("new.md", "delete");

		expect(stateStore.journal).toEqual([]);
	});

	it("turns a pending modify into a delete without retaining the note snapshot", async () => {
		const stateStore = new MemoryGitSyncStateStore();
		const journal = new GitJournal(stateStore);

		await journal.queueChange("existing.md", "modify", {
			id: "existing",
			title: "Existing",
			content: "body",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		await journal.queueChange("existing.md", "delete");

		expect(stateStore.journal).toEqual([
			{ filePath: "existing.md", operation: "delete", updatedAt: 100 },
		]);
	});

	it("restores deleted notes through storage and index services", async () => {
		const stateStore = new MemoryGitSyncStateStore();
		stateStore.journal = [
			{
				filePath: "deleted-note.md",
				operation: "delete",
				updatedAt: 100,
			},
		];
		const journal = new GitJournal(stateStore);

		await expect(journal.restorePendingChanges()).resolves.toBe(true);

		expect(mockStorageDeleteNote).toHaveBeenCalledWith("deleted-note");
		expect(mockIndexDelete).toHaveBeenCalledWith("deleted-note");
	});

	it("removes only entries from the flushed snapshot", async () => {
		const stateStore = new MemoryGitSyncStateStore();
		const flushed = {
			filePath: "flushed.md",
			operation: "modify" as const,
			updatedAt: 100,
		};
		stateStore.journal = [
			flushed,
			{ filePath: "newer.md", operation: "modify", updatedAt: 101 },
		];
		const journal = new GitJournal(stateStore);

		await journal.removeFlushedEntries([flushed]);

		expect(stateStore.journal).toEqual([
			{ filePath: "newer.md", operation: "modify", updatedAt: 101 },
		]);
	});
});
