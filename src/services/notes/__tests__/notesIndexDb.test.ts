import { vi } from "vitest";
const { mockListNoteFiles, mockLoadNote, mockIndexList } = vi.hoisted(() => ({
	mockListNoteFiles: vi.fn(),
	mockLoadNote: vi.fn(),
	mockIndexList: vi.fn(),
}));

vi.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		listNoteFiles: (...args: unknown[]) => mockListNoteFiles(...args),
		loadNote: (...args: unknown[]) => mockLoadNote(...args),
		indexList: (...args: unknown[]) => mockIndexList(...args),
		indexUpsert: vi.fn(),
		indexDelete: vi.fn(),
	},
}));

import {
	notesIndexDbGetBacklinks,
	notesIndexDbGetOrphanedNotes,
	notesIndexDbGetOutgoingLinks,
} from "../notesIndexDb";

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
