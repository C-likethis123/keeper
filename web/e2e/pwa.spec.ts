import { expect, test } from "@playwright/test";

test("PWA exposes install metadata and opens cached shell offline", async ({ page, context }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

	await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await context.setOffline(true);
	await page.reload();

	await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
});
