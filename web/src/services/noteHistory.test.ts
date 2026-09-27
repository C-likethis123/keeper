import "fake-indexeddb/auto";
import { storageEngine } from "@/services/storage/storageEngine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	captureBrowserNoteVersion,
	deleteBrowserNoteVersions,
	getBrowserNoteVersion,
	listBrowserNoteVersions,
} from "@web/services/noteHistory";

const note = {
	id: "note-1",
	title: "First",
	content: "Old text",
	noteType: "note" as const,
	isPinned: false,
	lastUpdated: 1,
	modified: 1,
	status: null,
	createdAt: null,
	completedAt: null,
	attachment: null,
	attachedVideo: null,
	resourceUrl: null,
	documentPositions: null,
};

describe("browser note history", () => {
	beforeEach(async () => {
		await storageEngine.initialize();
		await storageEngine.resetAllData();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("persists the prior note across service reloads and resolves it", async () => {
		await captureBrowserNoteVersion(note);
		const [version] = await listBrowserNoteVersions(note.id);
		expect(version.note).toEqual(note);
		expect(
			(await getBrowserNoteVersion(note.id, version.id))?.note.content,
		).toBe("Old text");
	});

	it("captures the prior persisted note before overwrite", async () => {
		await storageEngine.saveNote(note);
		const prior = await storageEngine.loadNote(note.id);
		expect(prior).not.toBeNull();
		await captureBrowserNoteVersion({
			...note,
			lastUpdated: prior?.lastUpdated ?? note.lastUpdated,
			modified: prior?.modified ?? note.modified,
		});
		await storageEngine.saveNote({ ...note, content: "New text" });

		expect((await listBrowserNoteVersions(note.id))[0]?.note.content).toBe(
			"Old text",
		);
	});

	it("orders newest first and retains only 100 versions", async () => {
		let now = 1000;
		vi.spyOn(Date, "now").mockImplementation(() => now++);
		for (let index = 0; index < 101; index += 1) {
			await captureBrowserNoteVersion({ ...note, content: `Version ${index}` });
		}

		const versions = await listBrowserNoteVersions(note.id);
		expect(versions).toHaveLength(100);
		expect(versions[0]?.note.content).toBe("Version 100");
		expect(versions.at(-1)?.note.content).toBe("Version 1");
	});

	it("restores by lookup and deletes all versions", async () => {
		await captureBrowserNoteVersion(note);
		const [version] = await listBrowserNoteVersions(note.id);
		expect((await getBrowserNoteVersion(note.id, version.id))?.note).toEqual(note);

		await deleteBrowserNoteVersions(note.id);
		expect(await listBrowserNoteVersions(note.id)).toEqual([]);
		expect(await getBrowserNoteVersion(note.id, version.id)).toBeNull();
	});
});
