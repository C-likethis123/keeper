import "fake-indexeddb/auto";
import { storageEngine } from "@/services/storage/storageEngine";
import {
	deleteStoredBrowserFile,
	downloadBytes,
	readClipboardImage,
	releaseLocalFile,
	resolveLocalFile,
	saveBytes,
	savePickedFile,
	writeClipboardText,
} from "@web/services/media";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("browser media boundary", () => {
	beforeEach(async () => {
		vi.restoreAllMocks();
		let objectUrl = 0;
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => `blob:keeper-test-${++objectUrl}`),
			revokeObjectURL: vi.fn(),
		});
		await storageEngine.initialize();
		await storageEngine.resetAllData();
	});

	it.each([
		["agenda.pdf", "application/pdf"],
		["book.epub", "application/epub+zip"],
	])("persists and reloads %s attachments", async (name, type) => {
		const file = {
			name,
			type,
			arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
		} as File;

		const path = await savePickedFile(file, "attachments");
		expect(path).toMatch(
			new RegExp(`^_attachments/.+\\.${name.split(".").at(-1)}$`),
		);
		expect(await storageEngine.readFileBytes(path)).toEqual(
			new Uint8Array([4, 5, 6]),
		);

		releaseLocalFile(path);
		const first = await resolveLocalFile(path, type);
		expect(await resolveLocalFile(path, type)).toBe(first);
		releaseLocalFile(path);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
	});

	it("persists and reloads picked and clipboard image bytes", async () => {
		const picked = await savePickedFile(
			{
				name: "photo.png",
				type: "image/png",
				arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
			} as File,
			"assets",
		);
		const pasted = await saveBytes(
			new Uint8Array([7, 8, 9]),
			"clipboard.png",
			"assets",
		);

		expect(picked).toMatch(/^assets\/.+\.png$/);
		expect(await storageEngine.readFileBytes(picked)).toEqual(
			new Uint8Array([1, 2]),
		);
		expect(await storageEngine.readFileBytes(pasted)).toEqual(
			new Uint8Array([7, 8, 9]),
		);
		releaseLocalFile(pasted);
		expect(await resolveLocalFile(pasted, "image/png")).toMatch(/^blob:/);
	});

	it("deletes canonical attachment bytes and cached object URL", async () => {
		const path = await saveBytes(
			new Uint8Array([3]),
			"delete.pdf",
			"attachments",
		);
		const url = await resolveLocalFile(path, "application/pdf");

		await deleteStoredBrowserFile(path);

		expect(await storageEngine.readFileBytes(path)).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
	});

	it("keeps canonical path traversal rejection", async () => {
		await expect(resolveLocalFile("../secret.pdf")).rejects.toThrow(
			"Path escapes notes root",
		);
	});

	it("uses browser clipboard and download APIs", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined);

		expect(await writeClipboardText("copied text")).toBe(true);
		expect(writeText).toHaveBeenCalledWith("copied text");
		expect(
			readClipboardImage({
				clipboardData: {
					files: [{ type: "image/png" }, { type: "application/pdf" }],
				},
			} as unknown as ClipboardEvent),
		).toEqual({ type: "image/png" });

		downloadBytes(new Uint8Array([7]), "export.bin");
		expect(click).toHaveBeenCalledOnce();
	});
});
