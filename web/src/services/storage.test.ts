import { beforeEach, describe, expect, it } from "vitest";
import { BrowserStorage } from "@/services/storage";

describe("BrowserStorage", () => {
	let storage: BrowserStorage;

	beforeEach(() => {
		storage = new BrowserStorage();
	});

	it("persists state and attachment bytes in IndexedDB", async () => {
		await storage.setState("theme", "dark");
		await storage.writeFile("attachments/agenda.pdf", new Uint8Array([1, 2, 3]));

		expect(await storage.getState("theme")).toBe("dark");
		expect(await storage.readFile("attachments/agenda.pdf")).toEqual(new Uint8Array([1, 2, 3]));
		expect(await storage.listFiles("attachments/")).toEqual(["attachments/agenda.pdf"]);

		await storage.deleteFile("attachments/agenda.pdf");
		expect(await storage.readFile("attachments/agenda.pdf")).toBeNull();
	});

	it("rejects paths outside browser storage", async () => {
		await expect(storage.writeFile("../secret", new Uint8Array())).rejects.toThrow("Path must remain");
		await expect(storage.readFile("/absolute/path")).rejects.toThrow("Path must remain");
	});
});
