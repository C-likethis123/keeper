import { NoteService } from "../noteService";
import type { NoteSaveInput } from "../types";

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockListNoteFiles = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();
const mockWriteFileBytes = jest.fn();
const mockListFilesRecursive = jest.fn();
const mockReadFileBytes = jest.fn();
const mockDeleteDirectory = jest.fn();
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
		writeFileBytes: (...args: unknown[]) => mockWriteFileBytes(...args),
		listFilesRecursive: (...args: unknown[]) => mockListFilesRecursive(...args),
		readFileBytes: (...args: unknown[]) => mockReadFileBytes(...args),
		deleteDirectory: (...args: unknown[]) => mockDeleteDirectory(...args),
	},
}));

const mockEnqueueNoteCreate = jest.fn();
const mockEnqueueNoteUpdate = jest.fn();
const mockEnqueueNoteDelete = jest.fn();
const mockScheduleSyncPush = jest.fn();

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
		process.env.EXPO_PUBLIC_SYNC_SERVER_URL = undefined;
		mockEnqueueNoteCreate.mockResolvedValue(undefined);
		mockEnqueueNoteUpdate.mockResolvedValue(undefined);
		mockEnqueueNoteDelete.mockResolvedValue(undefined);
		mockWriteFileBytes.mockResolvedValue(undefined);
		mockDeleteDirectory.mockResolvedValue(undefined);
	});

	describe("saveNote", () => {
		it("indexes templates in SQLite", async () => {
			const { NotesIndexService } = jest.requireMock(
				"@/services/notes/notesIndex",
			);
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

		it("indexes drawing without exposing serialized strokes", async () => {
			const { NotesIndexService } = jest.requireMock(
				"@/services/notes/notesIndex",
			);
			const content = '{"version":1,"strokes":[]}';
			mockSaveNote.mockResolvedValue({
				id: "drawing-1",
				title: "Sketch",
				content,
				isPinned: false,
				lastUpdated: 1000,
				noteType: "drawing",
				status: null,
			});

			await NoteService.saveNote({
				id: "drawing-1",
				title: "Sketch",
				content,
				isPinned: false,
				noteType: "drawing",
				status: null,
			});

			expect(NotesIndexService.upsertNote).toHaveBeenCalledWith(
				expect.objectContaining({
					noteId: "drawing-1",
					summary: "Drawing",
					noteType: "drawing",
				}),
			);
		});

		it("writes markdown edits back into Yjs before saving the snapshot", async () => {
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
			expect(mockWriteFileBytes).toHaveBeenCalledWith(
				expect.stringContaining(".keeper/history/note-1/"),
				expect.any(Uint8Array),
			);
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});

	});

	describe("deleteNote", () => {
		it("queues note.delete after local delete", async () => {
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("note-1");

			expect(mockEnqueueNoteDelete).toHaveBeenCalledWith("note-1");
			expect(mockDeleteDirectory).toHaveBeenCalledWith(
				".keeper/history/note-1",
			);
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});
	});

	describe("restoreNoteVersion", () => {
		it("restores snapshot through normal save path", async () => {
			const oldNote = {
				id: "note-1",
				title: "Old title",
				content: "Old body",
				isPinned: true,
				lastUpdated: 500,
				noteType: "note" as const,
				status: null,
			};
			const currentNote = {
				...oldNote,
				title: "Current title",
				content: "Current body",
				lastUpdated: 900,
			};
			mockReadFileBytes.mockResolvedValue(
				new TextEncoder().encode(
					JSON.stringify({
						formatVersion: 1,
						capturedAt: 600,
						note: oldNote,
					}),
				),
			);
			mockLoadNote.mockResolvedValue(currentNote);
			mockSaveNote.mockResolvedValue({ ...oldNote, lastUpdated: 1000 });

			const restored = await NoteService.restoreNoteVersion(
				"note-1",
				".keeper/history/note-1/version.json",
			);

			expect(mockSaveMarkdownToCrdt).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "note-1",
					title: "Old title",
					content: "Old body",
				}),
			);
			expect(mockWriteFileBytes).toHaveBeenCalledWith(
				expect.stringContaining(".keeper/history/note-1/"),
				expect.any(Uint8Array),
			);
			expect(restored.content).toBe("Old body");
		});
	});
});
