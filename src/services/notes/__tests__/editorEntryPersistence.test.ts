import { persistEditorEntry } from "../editorEntryPersistence";

const mockLoadNote = jest.fn();
const mockSaveNote = jest.fn();
const mockDeleteNote = jest.fn();

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		saveNote: (...args: unknown[]) => mockSaveNote(...args),
		deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
	},
}));

describe("persistEditorEntry", () => {
	beforeEach(() => {
		mockLoadNote.mockReset();
		mockSaveNote.mockReset();
		mockDeleteNote.mockReset();
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

	it("saves templates through NoteService with isPinned false", async () => {
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "tmpl-1",
			title: "My Template",
			content: "template body",
			isPinned: false,
			noteType: "template",
			status: null,
			isNewEntry: true,
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "tmpl-1",
				noteType: "template",
				isPinned: false,
			}),
			true,
		);
	});

	it("deletes old note when transitioning to template", async () => {
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "note-1",
			title: "Now a template",
			content: "body",
			isPinned: false,
			noteType: "template",
			previousNoteType: "note",
		});

		expect(mockSaveNote).toHaveBeenCalled();
		expect(mockDeleteNote).toHaveBeenCalledWith("note-1", "note");
	});

	it("deletes old template when transitioning from template", async () => {
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "tmpl-1",
			title: "Now a note",
			content: "body",
			isPinned: false,
			noteType: "note",
			previousNoteType: "template",
		});

		expect(mockSaveNote).toHaveBeenCalled();
		expect(mockDeleteNote).toHaveBeenCalledWith("tmpl-1", "template");
	});

	it("does not delete the note when transitioning between note types that share storage", async () => {
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "note-1",
			title: "Video: Containers from scratch",
			content: "body",
			isPinned: false,
			noteType: "resource",
			previousNoteType: "note",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				noteType: "resource",
			}),
			false,
		);
		expect(mockDeleteNote).not.toHaveBeenCalled();
	});
});
