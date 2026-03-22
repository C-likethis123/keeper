import { NotesIndexService } from "@/services/notes/notesIndex";
import { NoteService } from "@/services/notes/noteService";
import {
	findExactWikiLinkMatch,
	normalizeWikiLinkTitle,
	resolveOrCreateWikiLinkNoteId,
	resolveWikiLinkNoteId,
	shouldOpenWikiLink,
} from "../wikiLinkUtils";

describe("wikiLinkUtils", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
	});

	it("normalizes titles for case-insensitive matching", () => {
		expect(normalizeWikiLinkTitle("  Project Alpha  ")).toBe("project alpha");
	});

	it("finds an exact wiki link match by normalized title", () => {
		const match = findExactWikiLinkMatch(
			[
				{
					noteId: "note-1",
					title: "Daily Notes",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
				{
					noteId: "note-2",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
			"  project alpha ",
		);

		expect(match?.noteId).toBe("note-2");
	});

	it("resolves a wiki link title to an existing note id", async () => {
		jest.spyOn(NotesIndexService, "listNotes").mockResolvedValueOnce({
			items: [
				{
					noteId: "note-123",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		await expect(resolveWikiLinkNoteId("Project Alpha")).resolves.toBe(
			"note-123",
		);

		expect(NotesIndexService.listNotes).toHaveBeenCalledWith(
			"Project Alpha",
			expect.any(Number),
			0,
		);
	});

	it("creates a note when a wiki link target does not exist", async () => {
		jest.spyOn(NotesIndexService, "listNotes").mockResolvedValueOnce({ items: [] });
		jest.spyOn(NoteService, "saveNote").mockResolvedValueOnce({
			id: "new-note-id",
			title: "Project Alpha",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "note",
		});

		await expect(resolveOrCreateWikiLinkNoteId("Project Alpha")).resolves.toBe(
			"new-note-id",
		);
		expect(NoteService.saveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "generated-note-id",
				title: "Project Alpha",
				content: "",
				isPinned: false,
				noteType: "note",
			}),
			true,
		);
	});

	it("requires cmd-click on web but opens directly on native", () => {
		expect(shouldOpenWikiLink("ios")).toBe(true);
		expect(
			shouldOpenWikiLink("web", {
				nativeEvent: { metaKey: false },
			}),
		).toBe(false);
		expect(
			shouldOpenWikiLink("web", {
				nativeEvent: { metaKey: true },
			}),
		).toBe(true);
	});
});
