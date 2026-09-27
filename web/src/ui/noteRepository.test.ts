import "fake-indexeddb/auto";
import { storageEngine } from "@/services/storage/storageEngine";
import { beforeEach, describe, expect, it } from "vitest";
import {
	createBrowserLinkedNote,
	getBrowserNoteSurface,
	loadBrowserNotes,
	persistBrowserNotes,
	type BrowserNote,
} from "./noteRepository";

function note(
	id: string,
	lastUpdated: number,
	content = "markdown",
): BrowserNote {
	return {
		id,
		title: `Note ${id}`,
		content,
		noteType: "note",
		isPinned: false,
		lastUpdated,
		modified: lastUpdated,
		status: null,
		createdAt: lastUpdated,
		completedAt: null,
		attachment: null,
		attachedVideo: null,
		resourceUrl: null,
		documentPositions: null,
	};
}

describe("browser note repository", () => {
	beforeEach(async () => {
		await storageEngine.initialize();
		await storageEngine.resetAllData();
	});

	it("reloads notes from canonical storage", async () => {
		const document = {
			...note("document", 1, ""),
			attachment: "_attachments/agenda.pdf",
		};
		await persistBrowserNotes([document]);

		const loaded = await loadBrowserNotes();
		expect(loaded).toHaveLength(1);
		expect(loaded[0]).toMatchObject({
			id: "document",
			attachment: "_attachments/agenda.pdf",
			content: "",
		});
		expect(getBrowserNoteSurface(loaded[0])).toBe("document");
	});

	it("keeps one newest input for each note ID", async () => {
		await persistBrowserNotes([
			note("same", 1, "older"),
			note("same", 2, "newer"),
		]);

		const loaded = await loadBrowserNotes();
		expect(loaded).toHaveLength(1);
		expect(loaded[0]).toMatchObject({ id: "same", content: "newer" });
	});

	it("deletes canonical notes missing from next snapshot", async () => {
		await persistBrowserNotes([note("keep", 1), note("delete", 2)]);
		await persistBrowserNotes([note("keep", 1)]);

		expect((await loadBrowserNotes()).map(({ id }) => id)).toEqual(["keep"]);
	});

	it("creates one canonical target for a new wiki link", async () => {
		const created = await createBrowserLinkedNote(" Project Alpha ");
		const duplicate = await createBrowserLinkedNote("project alpha");
		expect(created).toMatchObject({
			title: "Project Alpha",
			content: "",
			noteType: "note",
			isPinned: false,
		});
		expect(duplicate?.id).toBe(created?.id);
		expect(await loadBrowserNotes()).toHaveLength(1);
	});
});
