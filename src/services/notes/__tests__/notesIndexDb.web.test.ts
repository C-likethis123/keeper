const mockListNoteFiles = jest.fn();
const mockLoadNote = jest.fn();
const mockIndexList = jest.fn();

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		listNoteFiles: (...args: unknown[]) => mockListNoteFiles(...args),
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		indexList: (...args: unknown[]) => mockIndexList(...args),
		indexUpsert: jest.fn(),
		indexDelete: jest.fn(),
	},
}));

import {
	notesIndexDbGetBacklinks,
	notesIndexDbGetOrphanedNotes,
	notesIndexDbGetOutgoingLinks,
} from "../notesIndexDb.web";

const notes = [
	{
		id: "alpha",
		title: "Alpha",
		content: "Links to [[Beta]]",
		lastUpdated: 3,
		isPinned: false,
		noteType: "note" as const,
	},
	{
		id: "beta",
		title: "Beta",
		content: "",
		lastUpdated: 2,
		isPinned: false,
		noteType: "note" as const,
	},
	{
		id: "orphan",
		title: "Orphan",
		content: "No links",
		lastUpdated: 1,
		isPinned: false,
		noteType: "note" as const,
	},
];

describe("browser notes index graph", () => {
	beforeEach(() => {
		mockListNoteFiles.mockResolvedValue(notes.map(({ id }) => ({ id })));
		mockLoadNote.mockImplementation((id: string) =>
			Promise.resolve(notes.find((note) => note.id === id) ?? null),
		);
	});

	it("derives wiki-link relationships from IndexedDB notes", async () => {
		await expect(notesIndexDbGetOutgoingLinks("alpha")).resolves.toEqual([
			"beta",
		]);
		await expect(notesIndexDbGetBacklinks("beta")).resolves.toEqual(["alpha"]);
		await expect(notesIndexDbGetOrphanedNotes()).resolves.toEqual(["orphan"]);
	});
});
