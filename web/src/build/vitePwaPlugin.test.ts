import { expect, it, vi } from "vitest";
import { renderServiceWorker } from "./vitePwaPlugin";

type WorkerEvent = {
	request?: Request;
	data?: unknown;
	respondWith?: ReturnType<typeof vi.fn>;
	waitUntil?: ReturnType<typeof vi.fn>;
};

function runtime(fetchMock = vi.fn()) {
	const handlers = new Map<string, (event: WorkerEvent) => void>();
	const cache = { put: vi.fn() };
	const caches = {
		open: vi.fn().mockResolvedValue(cache),
		keys: vi
			.fn()
			.mockResolvedValue([
				"keeper-vite-shell-old",
				"keeper-vite-shell-current",
				"keeper-shell-v4",
			]),
		delete: vi.fn().mockResolvedValue(true),
		match: vi.fn(),
	};
	const self = {
		location: { origin: "https://keeper.test" },
		clients: { claim: vi.fn().mockResolvedValue(undefined) },
		skipWaiting: vi.fn(),
		addEventListener: (
			type: string,
			handler: (event: WorkerEvent) => void,
		) => handlers.set(type, handler),
	};
	const code = renderServiceWorker(
		["/index.html", "/assets/app-abcdefgh.js"],
		"current",
	);
	new Function("self", "caches", "fetch", code)(self, caches, fetchMock);
	return { cache, caches, fetchMock, handlers, self };
}

it("leaves API and authentication routes outside service-worker caching", () => {
	const harness = runtime();
	for (const path of [
		"/api/notes",
		"/auth/callback",
		"/cdn-cgi/access/login",
		"/sync/push",
		"/clusters/active",
	]) {
		const respondWith = vi.fn();
		harness.handlers.get("fetch")?.({
			request: new Request(`https://keeper.test${path}`),
			respondWith,
		});
		expect(respondWith).not.toHaveBeenCalled();
	}
});

it("removes obsolete Vite caches without deleting Expo cache", async () => {
	const harness = runtime();
	const waitUntil = vi.fn();
	harness.handlers.get("activate")?.({ waitUntil });
	await waitUntil.mock.calls[0][0];

	expect(harness.caches.delete).toHaveBeenCalledWith("keeper-vite-shell-old");
	expect(harness.caches.delete).not.toHaveBeenCalledWith(
		"keeper-vite-shell-current",
	);
	expect(harness.caches.delete).not.toHaveBeenCalledWith("keeper-shell-v4");
});

it("uses cached application shell when navigation network fails", async () => {
	const shell = new Response("cached shell");
	const harness = runtime(vi.fn().mockRejectedValue(new Error("offline")));
	harness.caches.match.mockResolvedValue(shell);
	const respondWith = vi.fn();
	harness.handlers.get("fetch")?.({
		request: {
			method: "GET",
			mode: "navigate",
			url: "https://keeper.test/unknown",
		} as Request,
		respondWith,
	});

	expect(await respondWith.mock.calls[0][0]).toBe(shell);
});

it("uses cached application shell for failed navigation response", async () => {
	const shell = new Response("cached shell");
	const harness = runtime(
		vi.fn().mockResolvedValue(new Response("offline", { status: 504 })),
	);
	harness.caches.match.mockResolvedValue(shell);
	const respondWith = vi.fn();
	harness.handlers.get("fetch")?.({
		request: {
			method: "GET",
			mode: "navigate",
			url: "https://keeper.test/unknown",
		} as Request,
		respondWith,
	});

	expect(await respondWith.mock.calls[0][0]).toBe(shell);
});

it("does not cache failed hashed-asset response", async () => {
	const response = new Response("failed", { status: 500 });
	const harness = runtime(vi.fn().mockResolvedValue(response));
	harness.caches.match.mockResolvedValue(undefined);
	const respondWith = vi.fn();
	harness.handlers.get("fetch")?.({
		request: new Request("https://keeper.test/assets/app-abcdefgh.js"),
		respondWith,
	});

	expect(await respondWith.mock.calls[0][0]).toBe(response);
	expect(harness.cache.put).not.toHaveBeenCalled();
});

it("does not cache redirected authentication response", async () => {
	const redirectedResponse = {
		ok: true,
		redirected: true,
		type: "basic",
		url: "https://keeper.test/cdn-cgi/access/login",
		clone: vi.fn(),
	};
	const harness = runtime(vi.fn().mockResolvedValue(redirectedResponse));
	harness.caches.match.mockResolvedValue(undefined);
	const respondWith = vi.fn();
	harness.handlers.get("fetch")?.({
		request: new Request("https://keeper.test/assets/app-abcdefgh.js"),
		respondWith,
	});

	expect(await respondWith.mock.calls[0][0]).toBe(redirectedResponse);
	expect(harness.cache.put).not.toHaveBeenCalled();
});
