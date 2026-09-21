import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { browserStorage } from "@/services/storage";
import { captureBrowserNoteVersion, getBrowserNoteVersion, listBrowserNoteVersions } from "@/services/noteHistory";

const note = { id: "note-1", title: "First", content: "Old text", noteType: "note" as const, isPinned: false, lastUpdated: 1, modified: 1, status: null, createdAt: null, completedAt: null, attachment: null, attachedVideo: null, resourceUrl: null, documentPositions: null };

describe("browser note history", () => {
	beforeEach(async () => { await browserStorage.setState("note-history:v1:note-1", "[]"); await browserStorage.setState("note-history:v2:note-1", "[]"); });
	it("captures, lists, and resolves prior persisted notes", async () => {
		await captureBrowserNoteVersion(note);
		const [version] = await listBrowserNoteVersions(note.id);
		expect(version.note).toEqual(note);
		expect((await getBrowserNoteVersion(note.id, version.id))?.note.content).toBe("Old text");
	});

	it("falls back to and migrates retained v1 history", async () => {
		await browserStorage.setState("note-history:v1:note-1", JSON.stringify([{ id: "old-version", capturedAt: 10, note: { id: "note-1", title: "Legacy video", content: "https://video.example", noteType: "video", isPinned: true, updatedAt: 9 } }]));
		await browserStorage.setState("note-history:v2:note-1", "");
		const [version] = await listBrowserNoteVersions("note-1");
		expect(version.note).toMatchObject({ title: "Legacy video", attachedVideo: "https://video.example", content: "", lastUpdated: 9, isPinned: true });
		expect(JSON.parse((await browserStorage.getState("note-history:v2:note-1")) ?? "[]")).toHaveLength(1);
	});
});
