import {
	SyncRequestError,
	isSyncRequestError,
	parseRetryAfter,
} from "@/services/sync/syncRequestError";

describe("syncRequestError", () => {
	it("parses Retry-After seconds", () => {
		expect(parseRetryAfter("12", 0)).toBe(12_000);
	});

	it("parses Retry-After dates", () => {
		const now = Date.parse("2026-08-22T12:00:00Z");
		expect(parseRetryAfter("Sat, 22 Aug 2026 12:00:05 GMT", now)).toBe(5_000);
	});

	it("rejects invalid Retry-After values", () => {
		expect(parseRetryAfter("later", 0)).toBeNull();
		expect(parseRetryAfter(null, 0)).toBeNull();
	});

	it("identifies typed HTTP failures", () => {
		const error = new SyncRequestError("limited", 429, 5_000);
		expect(isSyncRequestError(error)).toBe(true);
		expect(error.status).toBe(429);
		expect(error.retryAfterMs).toBe(5_000);
	});
});
