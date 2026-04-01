import type { SQLiteDatabase } from "expo-sqlite";
import { buildFtsMatchQuery, listAll } from "../repository";

describe("buildFtsMatchQuery", () => {
	it("drops dangling punctuation tokens that break FTS queries", () => {
		expect(buildFtsMatchQuery("book -")).toBe("book*");
	});

	it("splits punctuation-delimited words into safe prefix terms", () => {
		expect(buildFtsMatchQuery("foo-bar")).toBe("foo* bar*");
	});

	it("returns null when the query has no searchable tokens", () => {
		expect(buildFtsMatchQuery(" - ")).toBeNull();
	});
});

describe("listAll", () => {
	it("falls back to the non-FTS query when the search text has no searchable tokens", async () => {
		const getAllAsync = jest.fn().mockResolvedValue([]);
		const database = {
			getAllAsync,
		} as unknown as SQLiteDatabase;

		await listAll(database, " - ", 20, 0);

		expect(getAllAsync).toHaveBeenCalledTimes(1);
		const [sql, ...params] = getAllAsync.mock.calls[0];
		expect(sql).not.toContain("MATCH ?");
		expect(params).toEqual([21, 0]);
	});

	it("uses the sanitized FTS query for punctuation-heavy searches", async () => {
		const getAllAsync = jest.fn().mockResolvedValue([]);
		const database = {
			getAllAsync,
		} as unknown as SQLiteDatabase;

		await listAll(database, "book -", 20, 0);

		expect(getAllAsync).toHaveBeenCalledTimes(1);
		const [sql, ...params] = getAllAsync.mock.calls[0];
		expect(sql).toContain("MATCH ?");
		expect(params).toEqual(["book*", 21, 0]);
	});
});
