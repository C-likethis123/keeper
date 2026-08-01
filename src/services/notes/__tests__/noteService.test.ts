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
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});

	});

	describe("deleteNote", () => {
		it("queues note.delete after local delete", async () => {
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("note-1");

			expect(mockEnqueueNoteDelete).toHaveBeenCalledWith("note-1");
			expect(mockScheduleSyncPush).toHaveBeenCalled();
		});
	});
});
