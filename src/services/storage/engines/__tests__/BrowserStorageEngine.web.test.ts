import { BrowserStorageEngine } from "../BrowserStorageEngine.web";

describe("BrowserStorageEngine", () => {
	it("fails clearly when IndexedDB returns no database", async () => {
		const engine = new BrowserStorageEngine();
		(
			engine as unknown as {
				databasePromise: Promise<IDBDatabase | null>;
			}
		).databasePromise = Promise.resolve(null);

		await expect(engine.initialize()).rejects.toThrow(
			"Browser storage is unavailable: IndexedDB did not return a usable database",
		);
	});
});
