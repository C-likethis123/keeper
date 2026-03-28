import { persistEditorEntry } from "../editorEntryPersistence";

const mockLoadNote = jest.fn();
const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();
const mockLoadTemplate = jest.fn();
const mockSaveTemplate = jest.fn();
const mockDeleteTemplate = jest.fn();

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
	},
}));

jest.mock("@/services/notes/templateService", () => ({
	TemplateService: {
		loadTemplate: (...args: unknown[]) => mockLoadTemplate(...args),
		saveTemplate: (...args: unknown[]) => mockSaveTemplate(...args),
		deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
	},
}));

describe("persistEditorEntry", () => {
	beforeEach(() => {
		mockLoadNote.mockReset();
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
		mockLoadTemplate.mockReset();
		mockSaveTemplate.mockReset();
		mockDeleteTemplate.mockReset();
	});

	it("skips saving notes when the persisted payload is unchanged", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: null,
			previousNoteType: "note",
		});

		expect(mockSaveNote).not.toHaveBeenCalled();
		expect(mockDeleteTemplate).not.toHaveBeenCalled();
	});

	it("skips saving notes when markdown only differs by editor normalization", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Draft note",
			content: "* item",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Draft note",
			content: "- item",
			isPinned: false,
			noteType: "note",
			status: null,
			previousNoteType: "note",
		});

		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("skips saving notes when status is null", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: null,
			previousNoteType: "note",
		});

		expect(mockSaveNote).not.toHaveBeenCalled();
	});

	it("saves notes when the payload changes", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Updated title",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: null,
			previousNoteType: "note",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				title: "Updated title",
				noteType: "note",
			}),
			false,
		);
	});
});
