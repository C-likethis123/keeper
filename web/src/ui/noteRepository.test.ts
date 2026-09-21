import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { browserStorage } from "@web/services/storage";
import { getBrowserNoteSurface, loadBrowserNotes } from "./noteRepository";

describe("browser note repository", () => {
	beforeEach(async () => { await browserStorage.setState("notes:v1", "[]"); await browserStorage.setState("notes:v2", ""); });
	it("migrates every legacy surface to canonical note fields", async () => {
		await browserStorage.setState("notes:v1", JSON.stringify([
			{ id: "n", title: "Note", content: "markdown", noteType: "note", isPinned: false, updatedAt: 1 },
			{ id: "d", title: "Doc", content: "attachments/a.pdf", noteType: "document", isPinned: true, updatedAt: 2 },
			{ id: "v", title: "Video", content: "https://video.example", noteType: "video", isPinned: false, updatedAt: 3 },
			{ id: "r", title: "Drawing", content: "data:image/png;base64,a", noteType: "drawing", isPinned: false, updatedAt: 4 },
		]));
		const notes = await loadBrowserNotes();
		expect(notes.map(getBrowserNoteSurface)).toEqual(["note", "document", "video", "drawing"]);
		expect(notes[1]).toMatchObject({ id: "d", attachment: "attachments/a.pdf", content: "", isPinned: true, lastUpdated: 2, modified: 2 });
		expect(notes[2]).toMatchObject({ id: "v", attachedVideo: "https://video.example", content: "", lastUpdated: 3 });
		expect(notes[3]).toMatchObject({ id: "r", noteType: "drawing", content: "data:image/png;base64,a", lastUpdated: 4 });
		expect(JSON.parse((await browserStorage.getState("notes:v2")) ?? "[]")).toHaveLength(4);
	});
});
