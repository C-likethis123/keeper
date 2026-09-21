import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBytes, readClipboardImage, releaseLocalFile, resolveLocalFile, savePickedFile, writeClipboardText } from "@web/services/media";
import { browserStorage } from "@web/services/storage";

describe("browser media boundary", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:keeper-test"),
			revokeObjectURL: vi.fn(),
		});
	});

	it("stores picked attachments and resolves a local blob URL", async () => {
		const file = {
			name: "agenda.pdf",
			arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
		} as File;

		const path = await savePickedFile(file, "attachments");
		expect(path).toMatch(/^attachments\/.+\.pdf$/);
		expect(await browserStorage.readFile(path)).toEqual(new Uint8Array([4, 5, 6]));
		expect(await resolveLocalFile(path, "application/pdf")).toBe("blob:keeper-test");

		releaseLocalFile(path);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:keeper-test");
	});

	it("uses browser clipboard and download APIs", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

		expect(await writeClipboardText("copied text")).toBe(true);
		expect(writeText).toHaveBeenCalledWith("copied text");
		expect(readClipboardImage({ clipboardData: { files: [{ type: "image/png" }, { type: "application/pdf" }] } } as unknown as ClipboardEvent)).toEqual({ type: "image/png" });

		downloadBytes(new Uint8Array([7]), "export.bin");
		expect(click).toHaveBeenCalledOnce();
	});
});
