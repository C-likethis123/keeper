import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const VITE_CACHE_PREFIX = "keeper-vite-shell-";
const ICONS = [
	"icon-192.png",
	"icon-512.png",
	"icon-maskable-512.png",
] as const;

export function renderServiceWorker(
	precacheUrls: string[],
	version: string,
): string {
	return `const CACHE_PREFIX = ${JSON.stringify(VITE_CACHE_PREFIX)};
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const SHELL_URL = "/index.html";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};
const PRECACHE_PATHS = new Set(PRECACHE_URLS.map((value) => new URL(value, self.location.origin).pathname));
const HASHED_ASSET = /\\/assets\\/.*-[A-Za-z0-9_-]{8,}\\./;
const PRIVATE_PATHS = ["/api", "/auth", "/oauth", "/callback", "/cdn-cgi", "/sync", "/clusters"];

function isPrivatePath(pathname) {
	return PRIVATE_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function canCache(response, requestedUrl) {
	if (!response || !response.ok || response.redirected || response.type === "opaque") return false;
	const responseUrl = new URL(response.url || requestedUrl, self.location.origin);
	return responseUrl.origin === self.location.origin && !isPrivatePath(responseUrl.pathname);
}

async function precache() {
	const cache = await caches.open(CACHE_NAME);
	await Promise.all(PRECACHE_URLS.map(async (url) => {
		try {
			const response = await fetch(url, {
				cache: "reload",
				credentials: "same-origin",
				redirect: "error",
			});
			if (canCache(response, url)) await cache.put(url, response);
		} catch {
			// Keep install recoverable. Missing assets never enter cache.
		}
	}));
}

async function navigationResponse(request) {
	try {
		const response = await fetch(request);
		if (response.ok) return response;
	} catch {
		// Fall through to cached shell.
	}
	return (await caches.match(SHELL_URL)) || Response.error();
}

async function staticResponse(request) {
	const cached = await caches.match(request, {
		ignoreSearch: true,
		ignoreVary: true,
	});
	if (cached) return cached;
	const response = await fetch(request);
	if (canCache(response, request.url)) {
		const cache = await caches.open(CACHE_NAME);
		await cache.put(request, response.clone());
	}
	return response;
}

self.addEventListener("install", (event) => {
	event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		const names = await caches.keys();
		await Promise.all(names
			.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
			.map((name) => caches.delete(name)));
		await self.clients.claim();
	})());
});

self.addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return;
	if (request.mode === "navigate") {
		event.respondWith(navigationResponse(request));
		return;
	}
	if (PRECACHE_PATHS.has(url.pathname) || HASHED_ASSET.test(url.pathname)) {
		event.respondWith(staticResponse(request));
	}
});
`;
}

function iconSource(name: (typeof ICONS)[number]) {
	return readFileSync(
		fileURLToPath(new URL(`../../../public/icons/${name}`, import.meta.url)),
	);
}

function manifestSource() {
	return readFileSync(
		fileURLToPath(
			new URL("../../../web/public/manifest.webmanifest", import.meta.url),
		),
	);
}

export function vitePwaPlugin(): Plugin {
	return {
		name: "keeper-vite-pwa",
		apply: "build",
		buildStart() {
			for (const name of ICONS) {
				this.emitFile({
					type: "asset",
					fileName: `icons/${name}`,
					source: iconSource(name),
				});
			}
		},
		generateBundle(_options, bundle) {
			const bundleEntries = Object.entries(bundle).sort(([left], [right]) =>
				left.localeCompare(right),
			);
			const outputUrls = bundleEntries
				.map(([fileName]) => fileName)
				.filter((fileName) => fileName !== "service-worker.js")
				.map((fileName) => `/${fileName}`);
			const precacheUrls = Array.from(
				new Set([
					"/index.html",
					...outputUrls,
					"/manifest.webmanifest",
					...ICONS.map((name) => `/icons/${name}`),
				]),
			).sort();
			const versionHash = createHash("sha256").update(
				renderServiceWorker(precacheUrls, "__VERSION__"),
			);
			for (const [fileName, output] of bundleEntries) {
				versionHash.update(fileName);
				versionHash.update(output.type === "chunk" ? output.code : output.source);
			}
			versionHash.update(manifestSource());
			for (const name of ICONS) versionHash.update(iconSource(name));
			const version = versionHash.digest("hex").slice(0, 12);
			this.emitFile({
				type: "asset",
				fileName: "service-worker.js",
				source: renderServiceWorker(precacheUrls, version),
			});
		},
	};
}
