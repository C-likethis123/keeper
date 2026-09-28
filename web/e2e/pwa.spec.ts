import { expect, test } from "@playwright/test";

async function waitForActiveWorker(page: import("@playwright/test").Page) {
	await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function createNote(
	page: import("@playwright/test").Page,
	title: string,
) {
	await page.getByRole("button", { name: "Take a note" }).click();
	await page.getByLabel("Note title").fill(title);
	await page.getByRole("button", { name: "Close note" }).click();
	await expect(page.getByLabel("Title")).toHaveValue(title);
}

async function readQueuedOperationCount(
	page: import("@playwright/test").Page,
) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("keeper-pwa-storage", 2);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const record = await new Promise<{ data: ArrayBuffer } | undefined>(
			(resolve, reject) => {
				const request = database
					.transaction("files", "readonly")
					.objectStore("files")
					.get(".keeper/sync-state/keeper%3Async%3Aop-queue");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			},
		);
		database.close();
		if (!record) return 0;
		return JSON.parse(new TextDecoder().decode(record.data)).length as number;
	});
}

test("PWA emits valid install metadata and activates generated worker", async ({
	page,
	request,
}) => {
	await page.goto("/");
	await expect(page.getByRole("main", { name: "Notes" })).toBeVisible();
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
		"href",
		"/manifest.webmanifest",
	);
	const manifestResponse = await request.get("/manifest.webmanifest");
	expect(manifestResponse.ok()).toBe(true);
	const manifest = await manifestResponse.json();
	expect(manifest).toMatchObject({
		name: "Keeper",
		short_name: "Keeper",
		start_url: "/",
		scope: "/",
		display: "standalone",
	});
	for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
		expect((await request.get(icon)).ok()).toBe(true);
	}

	await waitForActiveWorker(page);
	expect(
		await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
	).toContain("/service-worker.js");
});

test("offline note edit survives reload, stays queued, and reconnect triggers sync", async ({
	page,
	context,
}) => {
	let apiRequests = 0;
	await page.route("**/api/**", async (route) => {
		apiRequests += 1;
		await route.fulfill({ status: 503, body: "offline test" });
	});
	await page.goto("/");
	await createNote(page, "Offline original");
	await waitForActiveWorker(page);
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByLabel("Title")).toHaveValue("Offline original");

	await page.getByLabel("Title").fill("Offline edited");
	await page.keyboard.press("Control+s");
	await expect.poll(() => readQueuedOperationCount(page)).toBeGreaterThan(0);
	await page.reload();
	await expect(page.getByLabel("Title")).toHaveValue("Offline edited");

	const beforeReconnect = apiRequests;
	await context.setOffline(false);
	await expect.poll(() => apiRequests).toBeGreaterThan(beforeReconnect);
	expect(await readQueuedOperationCount(page)).toBeGreaterThan(0);
});

test("local PDF attachment renders from IndexedDB after offline restart", async ({
	page,
	context,
}) => {
	await page.route("**/api/**", (route) =>
		route.fulfill({ status: 503, body: "offline test" }),
	);
	await page.goto("/");
	await createNote(page, "Offline PDF");
	const chooserPromise = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "Attach PDF or ePub" }).click();
	const chooser = await chooserPromise;
	await chooser.setFiles({
		name: "offline.pdf",
		mimeType: "application/pdf",
		buffer: Buffer.from("%PDF-1.4\n% offline fixture\n"),
	});
	await expect(page.locator(".browser-editor-panel iframe")).toBeVisible();
	await waitForActiveWorker(page);
	await context.setOffline(true);
	await page.reload();

	await expect(page.getByLabel("Title")).toHaveValue("Offline PDF");
	await expect(page.locator(".browser-editor-panel iframe")).toBeVisible();
});

test("unknown offline navigation receives cached application shell", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await waitForActiveWorker(page);
	await context.setOffline(true);
	await page.goto("/not-a-real-route");

	await expect(page.getByRole("main", { name: "Notes" })).toBeVisible();
});
