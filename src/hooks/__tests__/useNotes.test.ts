import type { NoteIndexItem } from "@/services/notes/notesIndex";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note, NoteListFilters } from "@/services/notes/types";
import { computeSections, loadNotesPage } from "../useNotes";

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		listNotes: jest.fn(),
	},
}));

function makeItem(noteId: string): NoteIndexItem {
	return {
		noteId,
		title: noteId,
		summary: "",
		updatedAt: 0,
		isPinned: false,
		noteType: "note",
		status: null,
	};
}

function makeNote(id: string): Note {
	return {
		id,
		title: id,
		content: "",
		isPinned: false,
		noteType: "note",
	};
}

describe("loadNotesPage", () => {
	const mockListNotes = jest.mocked(NotesIndexService.listNotes);
	const filters: NoteListFilters = { hideDone: false };

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("loads one page and preserves next-page cursor", async () => {
		mockListNotes.mockResolvedValueOnce({
			items: [makeItem("note-1")],
			cursor: 60,
		});

		const result = await loadNotesPage({ query: "", filters, offset: 0 });

		expect(result.items.map((item) => item.noteId)).toEqual(["note-1"]);
		expect(result.cursor).toBe(60);
		expect(mockListNotes).toHaveBeenCalledTimes(1);
		expect(mockListNotes).toHaveBeenCalledWith("", 60, 0, filters);
	});

	it("limits cluster sections to notes loaded by pagination", () => {
		const sections = computeSections(
			[makeNote("note-1")],
			[],
			new Set(),
			new Set(),
			[
				{
					id: "cluster-1",
					title: "Cluster",
					clusterId: "cluster-1",
					memberNoteIds: ["note-1", "note-2"],
				},
			],
			false,
		);

		expect(sections).toHaveLength(1);
		expect(sections[0]?.notes.map((note) => note.id)).toEqual(["note-1"]);
		expect(sections[0]?.memberNoteIds).toEqual(["note-1", "note-2"]);
	});
});
