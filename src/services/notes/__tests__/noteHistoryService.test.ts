import {
	captureNoteVersion,
	deleteNoteVersions,
	getNoteVersion,
	listNoteVersions,
} from "@/services/notes/noteHistoryService";
import type { Note } from "@/services/notes/types";

const mockReadFileBytes = jest.fn();
const mockWriteFileBytes = jest.fn();
const mockListFilesRecursive = jest.fn();
const mockDeleteDirectory = jest.fn();

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		readFileBytes: (...args: unknown[]) => mockReadFileBytes(...args),
		writeFileBytes: (...args: unknown[]) => mockWriteFileBytes(...args),
		listFilesRecursive: (...args: unknown[]) => mockListFilesRecursive(...args),
		deleteDirectory: (...args: unknown[]) => mockDeleteDirectory(...args),
	},
}));

const note: Note = {
	id: "note/one",
	title: "First",
	content: "Old content",
	isPinned: false,
	lastUpdated: 900,
	noteType: "note",
	status: null,
};

function storedVersion(
	capturedAt: number,
	storedNote: Note = note,
): Uint8Array {
	return new TextEncoder().encode(
		JSON.stringify({ formatVersion: 1, capturedAt, note: storedNote }),
	);
}

describe("noteHistoryService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("captures immutable note snapshots under encoded note directory", async () => {
		jest.spyOn(Date, "now").mockReturnValue(1000);
		mockWriteFileBytes.mockResolvedValue(undefined);

		await captureNoteVersion(note);

		expect(mockWriteFileBytes).toHaveBeenCalledWith(
			expect.stringMatching(/^\.keeper\/history\/note%2Fone\/1000-.+\.json$/),
			expect.any(Uint8Array),
		);
		const bytes = mockWriteFileBytes.mock.calls[0][1] as Uint8Array;
		expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
			formatVersion: 1,
			capturedAt: 1000,
			note,
		});
	});

	it("loads valid versions newest first and skips corrupt snapshots", async () => {
		const directory = ".keeper/history/note%2Fone";
		mockListFilesRecursive.mockResolvedValue([
			`${directory}/old.json`,
			`${directory}/broken.json`,
			`${directory}/new.json`,
		]);
		mockReadFileBytes.mockImplementation((path: string) => {
			if (path.endsWith("old.json")) return storedVersion(1000);
			if (path.endsWith("new.json")) return storedVersion(2000);
			return new TextEncoder().encode("not json");
		});

		const versions = await listNoteVersions(note.id);

		expect(mockListFilesRecursive).toHaveBeenCalledWith(directory);
		expect(versions.map((version) => version.capturedAt)).toEqual([2000, 1000]);
	});

	it("rejects version paths outside requested note history", async () => {
		expect(
			await getNoteVersion(note.id, ".keeper/history/other/v.json"),
		).toBeNull();
		expect(mockReadFileBytes).not.toHaveBeenCalled();
	});

	it("deletes all snapshots for note", async () => {
		mockDeleteDirectory.mockResolvedValue(undefined);

		await deleteNoteVersions(note.id);

		expect(mockDeleteDirectory).toHaveBeenCalledWith(
			".keeper/history/note%2Fone",
		);
	});
});
