import { beforeEach, describe, expect, it } from "vitest";
import { BrowserStorage } from "@web/services/storage";

describe("BrowserStorage", () => {
	let storage: BrowserStorage;

	beforeEach(() => {
		storage = new BrowserStorage();
	});

	it("persists browser-only state in IndexedDB", async () => {
		await storage.setState("theme", "dark");

		expect(await storage.getState("theme")).toBe("dark");
	});
});
