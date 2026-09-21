import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { browserStorage } from "@/services/storage";
import { captureBrowserNoteVersion, getBrowserNoteVersion, listBrowserNoteVersions } from "@/services/noteHistory";

const note = { id: "note-1", title: "First", content: "Old text", noteType: "note" as const, isPinned: false, updatedAt: 1 };

describe("browser note history", () => {
	beforeEach(async () => { await browserStorage.setState("note-history:v1:note-1", "[]"); });
	it("captures, lists, and resolves prior persisted notes", async () => {
		await captureBrowserNoteVersion(note);
		const [version] = await listBrowserNoteVersions(note.id);
		expect(version.note).toEqual(note);
		expect((await getBrowserNoteVersion(note.id, version.id))?.note.content).toBe("Old text");
	});
});
