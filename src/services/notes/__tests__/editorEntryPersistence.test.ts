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
		jest.restoreAllMocks();
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
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: null,
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
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Draft note",
			content: "- item",
			isPinned: false,
			noteType: "note",
			status: null,
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
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Updated title",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: null,
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

	it("saves templates through NoteService", async () => {
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "tmpl-1",
			title: "My Template",
			content: "template body",
			isPinned: true,
			noteType: "template",
			status: null,
			isNewEntry: true,
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "tmpl-1",
				noteType: "template",
				isPinned: true,
			}),
			true,
		);
	});

	it("updates an existing note when transitioning to template", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Plain note",
			content: "body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Now a template",
			content: "body",
			isPinned: false,
			noteType: "template",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				noteType: "template",
			}),
			false,
		);
		expect(mockDeleteNote).not.toHaveBeenCalled();
	});

	it("updates an existing template when transitioning from template", async () => {
		mockLoadNote.mockResolvedValue({
			id: "tmpl-1",
			title: "Template",
			content: "body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "template",
			status: null,
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "tmpl-1",
			title: "Now a note",
			content: "body",
			isPinned: false,
			noteType: "note",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "tmpl-1",
				noteType: "note",
			}),
			false,
		);
		expect(mockDeleteNote).not.toHaveBeenCalled();
	});

	it("does not delete the note when transitioning between note types that share storage", async () => {
		mockLoadNote.mockResolvedValue({
			id: "note-1",
			title: "Plain note",
			content: "body",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "note",
			status: null,
			createdAt: null,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "note-1",
			title: "Video: Containers from scratch",
			content: "body",
			isPinned: false,
			noteType: "resource",
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

	it("stamps createdAt for newly persisted todo notes", async () => {
		jest.spyOn(Date, "now").mockReturnValue(1710000000000);
		mockLoadNote.mockResolvedValue(null);

		await persistEditorEntry({
			id: "todo-1",
			title: "TODO: Ship release",
			content: "",
			isPinned: false,
			noteType: "todo",
			status: "open",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				noteType: "todo",
				status: "open",
				createdAt: 1710000000000,
				completedAt: null,
			}),
			false,
		);
	});

	it("stamps completedAt when an existing todo moves to done", async () => {
		jest.spyOn(Date, "now").mockReturnValue(1710003600000);
		mockLoadNote.mockResolvedValue({
			id: "todo-1",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1710000000000,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		await persistEditorEntry({
			id: "todo-1",
			title: "TODO: Ship release",
			content: "",
			isPinned: false,
			noteType: "todo",
			status: "done",
		});

		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				createdAt: 1710000000000,
				completedAt: 1710003600000,
				status: "done",
			}),
			false,
		);
	});
});
