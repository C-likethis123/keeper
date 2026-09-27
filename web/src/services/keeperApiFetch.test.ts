import { configureSyncServerUrl } from "@keeper/services/sync/config";
import { keeperApiFetch } from "@keeper/services/sync/keeperApiFetch";
import { listSyncNoteIds } from "@keeper/services/sync/remoteSyncClient";
import { isSyncAuthRequiredError } from "@keeper/services/sync/syncRequestError";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	configureSyncServerUrl(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("browser Keeper API", () => {
	it("supports same-origin /api and includes browser credentials", async () => {
		configureSyncServerUrl("/api/");
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await keeperApiFetch("/sync/note-ids");

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/sync/note-ids",
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("strips caller-controlled trusted and bearer headers", async () => {
		configureSyncServerUrl("/api");
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await keeperApiFetch("/sync/note-ids", {
			headers: {
				Authorization: "Bearer browser-token",
				"cf-access-jwt-assertion": "spoofed",
				"x-keeper-access-jwt-assertion": "spoofed",
				"x-keeper-private-proxy-token": "spoofed",
				"x-safe-header": "kept",
			},
		});

		const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;
		expect(headers.get("authorization")).toBeNull();
		expect(headers.get("cf-access-jwt-assertion")).toBeNull();
		expect(headers.get("x-keeper-access-jwt-assertion")).toBeNull();
		expect(headers.get("x-keeper-private-proxy-token")).toBeNull();
		expect(headers.get("x-safe-header")).toBe("kept");
	});

	it.each([401, 403])(
		"converts HTTP %s into typed auth-required error",
		async (status) => {
			configureSyncServerUrl("/api");
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue(
					new Response('{"error":"cloudflare_access_required"}', { status }),
				),
			);

			const error = await listSyncNoteIds().catch((caught) => caught);
			expect(isSyncAuthRequiredError(error)).toBe(true);
			expect(error).toMatchObject({ status });
		},
	);
});
