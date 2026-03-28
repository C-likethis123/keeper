import { NoteService } from "../noteService";

const mockSaveNote = jest.fn();
const mockLoadNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockListNoteFiles = jest.fn();
const mockIndexUpsert = jest.fn();
const mockIndexDelete = jest.fn();

jest.mock("@/services/storage/storageEngine", () => ({
	getStorageEngine: () => ({
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
		listNoteFiles: (...args: unknown[]) => mockListNoteFiles(...args),
		indexUpsert: (...args: unknown[]) => mockIndexUpsert(...args),
		indexDelete: (...args: unknown[]) => mockIndexDelete(...args),
	}),
}));

const mockQueueChange = jest.fn();
const mockScheduleCommitBatch = jest.fn();

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		queueChange: (...args: unknown[]) => mockQueueChange(...args),
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
		it("queues template saves with templates/ prefix", async () => {
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

			expect(mockQueueChange).toHaveBeenCalledWith(
				"templates/tmpl-1.md",
				"add",
			);
		});

		it("queues regular note saves without prefix", async () => {
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

			expect(mockQueueChange).toHaveBeenCalledWith("note-1.md", "add");
		});

		it("does not index templates in SQLite", async () => {
			const { NotesIndexService } = jest.requireMock(
				"@/services/notes/notesIndex",
			);
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

			expect(NotesIndexService.upsertNote).not.toHaveBeenCalled();
		});
	});

	describe("deleteNote - git path routing", () => {
		it("queues template deletes with templates/ prefix", async () => {
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("tmpl-1", "template");

			expect(mockQueueChange).toHaveBeenCalledWith(
				"templates/tmpl-1.md",
				"delete",
			);
		});

		it("queues regular note deletes without prefix", async () => {
			mockDeleteNote.mockResolvedValue(true);

			await NoteService.deleteNote("note-1");

			expect(mockQueueChange).toHaveBeenCalledWith("note-1.md", "delete");
		});

		it("does not queue git change when storage delete fails", async () => {
			mockDeleteNote.mockResolvedValue(false);
			await NoteService.deleteNote("note-1");
			expect(mockQueueChange).not.toHaveBeenCalled();
		});
	});
});
