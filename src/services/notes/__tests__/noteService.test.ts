import { NoteService } from "../noteService";

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockListNoteFiles = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();

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

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		queueChangeAsync: (...args: unknown[]) => mockQueueChangeAsync(...args),
		scheduleCommitBatch: () => mockScheduleCommitBatch(),
	},
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
	});

	describe("saveNote - git path routing", () => {
		it("queues template saves in the notes root", async () => {
			mockQueueChangeAsync.mockResolvedValue(undefined);
			mockSaveNote.mockResolvedValue({
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: false,
				lastUpdated: 1000,
				noteType: "template",
				status: null,
			});

			await NoteService.saveNote(
				{
					id: "tmpl-1",
					title: "My Template",
					content: "body",
					isPinned: false,
					noteType: "template",
					status: null,
				},
				true,
			);

			expect(mockQueueChangeAsync).toHaveBeenCalledWith("tmpl-1.md", "add", {
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: false,
				noteType: "template",
				status: null,
				createdAt: undefined,
				completedAt: undefined,
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
			});
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
				isPinned: false,
				lastUpdated: 1000,
				noteType: "template",
				status: null,
			});

			await NoteService.saveNote({
				id: "tmpl-1",
				title: "My Template",
				content: "body",
				isPinned: false,
				noteType: "template",
				status: null,
			});

			expect(NotesIndexService.upsertNote).toHaveBeenCalledWith({
				noteId: "tmpl-1",
				summary: "body",
				title: "My Template",
				isPinned: false,
				updatedAt: 1000,
				noteType: "template",
				status: null,
			});
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
	});
});
