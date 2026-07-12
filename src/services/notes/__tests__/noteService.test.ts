import { NoteService } from "../noteService";
import type { NoteSaveInput } from "../types";

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockListNoteFiles = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();
const mockSaveMarkdownToCrdt = jest.fn((note: NoteSaveInput) =>
	Promise.resolve(note),
);
const mockDeleteCrdtNote = jest.fn();

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
		listNoteFiles: (...args: unknown[]) => mockListNoteFiles(...args),
		indexUpsert: (...args: unknown[]) => mockIndexUpsert(...args),
		indexDelete: (...args: unknown[]) => mockIndexDelete(...args),
	},
}));

const mockQueueChangeAsync = jest.fn();
const mockScheduleCommitBatch = jest.fn();
const mockEnqueueNoteCreate = jest.fn();
const mockEnqueueNoteUpdate = jest.fn();
const mockEnqueueNoteDelete = jest.fn();
const mockScheduleSyncPush = jest.fn();

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		queueChangeAsync: (...args: unknown[]) => mockQueueChangeAsync(...args),
		scheduleCommitBatch: () => mockScheduleCommitBatch(),
	},
}));

jest.mock("@/services/sync/syncOpQueue", () => ({
	enqueueNoteCreate: (...args: unknown[]) => mockEnqueueNoteCreate(...args),
	enqueueNoteUpdate: (...args: unknown[]) => mockEnqueueNoteUpdate(...args),
	enqueueNoteDelete: (...args: unknown[]) => mockEnqueueNoteDelete(...args),
}));

jest.mock("@/services/sync/syncPushService", () => ({
	scheduleSyncPush: () => mockScheduleSyncPush(),
}));

jest.mock("@/services/notes/crdtNoteService", () => ({
	saveMarkdownToCrdt: (note: NoteSaveInput) => mockSaveMarkdownToCrdt(note),
	deleteCrdtNote: (noteId: string) => mockDeleteCrdtNote(noteId),
}));

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		upsertNote: jest.fn(),
		deleteNote: jest.fn(),
	},
	extractSummary: (content: string) => content.slice(0, 50),
}));

describe("NoteService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.EXPO_PUBLIC_SERVER_SYNC_ENABLED = undefined;
		mockEnqueueNoteCreate.mockResolvedValue(undefined);
		mockEnqueueNoteUpdate.mockResolvedValue(undefined);
		mockEnqueueNoteDelete.mockResolvedValue(undefined);
	});

	describe("saveNote - git path routing", () => {
		it("queues template saves in the notes root", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveNote.mockResolvedValue({
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: true,
				lastUpdated: 1000,
				noteType: "template",
				status: null,
			});

			await NoteService.saveNote(
				{
					id: "tmpl-1",
					title: "My Template",
					content: "body",
					isPinned: true,
					noteType: "template",
					status: null,
				},
				true,
			);

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("tmpl-1.md", "add", {
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: true,
				noteType: "template",
				status: null,
				createdAt: undefined,
				completedAt: undefined,
				attachment: null,
				attachedVideo: null,
				resourceUrl: null,
				documentPositions: null,
			});
		});

		it("queues regular note saves without prefix", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveNote.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			});

			await NoteService.saveNote(
				{
					id: "note-1",
					title: "My Note",
					content: "body",
					isPinned: false,
					noteType: "note",
					status: null,
				},
				true,
			);

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("note-1.md", "add", {
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				noteType: "note",
				status: null,
				createdAt: undefined,
				completedAt: undefined,
				attachment: null,
				attachedVideo: null,
				resourceUrl: null,
				documentPositions: null,
			});
		});

		it("writes markdown before queueing git journal", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveNote.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "newer body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			});

			await NoteService.saveNote({
				id: "note-1",
				title: "My Note",
				content: "newer body",
				isPinned: false,
				noteType: "note",
				status: null,
			});

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("note-1.md", "modify", {
				id: "note-1",
				title: "My Note",
				content: "newer body",
				isPinned: false,
				noteType: "note",
				status: null,
				createdAt: undefined,
				completedAt: undefined,
				attachment: null,
				attachedVideo: null,
				resourceUrl: null,
				documentPositions: null,
			});
			expect(
				mockSaveNote.mock.invocationCallOrder[0],
			).toBeLessThan(mockQueueChangeAsync.mock.invocationCallOrder[0]);
		});

		it("does not block local saves on stalled git journaling", async () => {
			mockQueueChangeAsync.mockReturnValue(new Promise(() => {}));
			mockSaveNote.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			});

			await expect(
				NoteService.saveNote({
					id: "note-1",
					title: "My Note",
					content: "body",
					isPinned: false,
					noteType: "note",
					status: null,
				}),
			).resolves.toMatchObject({ id: "note-1", content: "body" });

			expect(mockQueueChangeAsync).toHaveBeenCalledWith(
				"note-1.md",
				"modify",
				expect.objectContaining({ content: "body" }),
			);
			expect(mockScheduleCommitBatch).not.toHaveBeenCalled();
		});

		it("indexes templates in SQLite", async () => {
			const { NotesIndexService } = jest.requireMock(
				"@/services/notes/notesIndex",
			);
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveNote.mockResolvedValue({
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: true,
				lastUpdated: 1000,
				noteType: "template",
				status: null,
			});

			await NoteService.saveNote({
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: true,
				noteType: "template",
				status: null,
			});

			expect(NotesIndexService.upsertNote).toHaveBeenCalledWith({
				noteId: "tmpl-1",
				summary: "body",
				title: "My Template",
				isPinned: true,
				updatedAt: 1000,
				noteType: "template",
				status: null,
			});
		});

		it("writes markdown edits back into Yjs before saving the snapshot", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveMarkdownToCrdt.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "snapshot body from crdt",
				isPinned: false,
				noteType: "note",
				status: null,
			});
			mockSaveNote.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "snapshot body from crdt",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			});

			await NoteService.saveNote({
				id: "note-1",
				title: "My Note",
				content: "snapshot body",
				isPinned: false,
				noteType: "note",
				status: null,
			});

			expect(mockSaveMarkdownToCrdt).toHaveBeenCalledWith({
				id: "note-1",
				title: "My Note",
				content: "snapshot body",
				isPinned: false,
				noteType: "note",
				status: null,
			});
			expect(mockSaveNote).toHaveBeenCalledWith(
				expect.objectContaining({ content: "snapshot body from crdt" }),
			);
		});

		it("queues note.create for new local saves", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			const saved = {
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			};
			mockSaveNote.mockResolvedValue(saved);

			await NoteService.saveNote(
				{
					id: "note-1",
					title: "My Note",
					content: "body",
					isPinned: false,
					noteType: "note",
					status: null,
				},
				true,
			);

			expect(mockEnqueueNoteCreate).toHaveBeenCalledWith(saved);
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});

		it("queues note.update for existing local saves", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockLoadNote.mockResolvedValue({
				id: "note-1",
				title: "My Note",
				content: "old body",
				isPinned: false,
				lastUpdated: 999,
				noteType: "note",
				status: null,
			});
			const saved = {
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			};
			mockSaveNote.mockResolvedValue(saved);

			await NoteService.saveNote({
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				noteType: "note",
				status: null,
			});

			expect(mockEnqueueNoteUpdate).toHaveBeenCalledWith(saved);
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});

		it("skips Git journal when server sync flag is enabled", async () => {
			process.env.EXPO_PUBLIC_SERVER_SYNC_ENABLED = "true";
			mockQueueChangeAsync.mockResolvedValue(undefined);
			const saved = {
				id: "note-1",
				title: "My Note",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "note",
				status: null,
			};
			mockSaveNote.mockResolvedValue(saved);

			await NoteService.saveNote(
				{
					id: "note-1",
					title: "My Note",
					content: "body",
					isPinned: false,
					noteType: "note",
					status: null,
				},
				true,
			);

			expect(mockQueueChangeAsync).not.toHaveBeenCalled();
			expect(mockEnqueueNoteCreate).toHaveBeenCalledWith(saved);
		});
	});

	describe("deleteNote - git path routing", () => {
		it("queues template deletes in the notes root", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("tmpl-1");

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("tmpl-1.md", "delete");
		});

		it("queues regular note deletes without prefix", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("note-1");

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("note-1.md", "delete");
		});

		it("does not queue git change when storage delete fails", async () => {
			mockDeleteNote.mockResolvedValue(false);
			await NoteService.deleteNote("note-1");
			expect(mockQueueChangeAsync).not.toHaveBeenCalled();
		});

		it("queues note.delete after local delete", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("note-1");

			expect(mockEnqueueNoteDelete).toHaveBeenCalledWith("note-1");
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});
	});
});
