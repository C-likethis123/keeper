import { expect, test } from "@playwright/test";
import { NOTE_GRID_PAGE_SIZE } from "../../src/constants/pagination";

for (const width of [390, 1280]) {
	test(`home scroll reveals next page at width ${width}`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width, height: 844 });
		await page.goto("/");
		for (let index = 0; index <= NOTE_GRID_PAGE_SIZE; index += 1) {
			await page.getByRole("button", { name: "Take a note" }).click();
			await page.getByLabel("Note title").fill(`Pagination ${index}`);
			await page
				.getByLabel("Note content", { exact: true })
				.fill("Scroll regression content. ".repeat(30));
			await page.getByRole("button", { name: "Close note" }).click();
			await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
				`Pagination ${index}`,
			);
			await page.getByRole("tab", { name: "Home", exact: true }).click();
		}
		const notes = page.getByRole("region", { name: "Notes", exact: true });
		await expect(notes.getByText("Pagination 0", { exact: true })).toHaveCount(
			0,
		);
		expect(
			await notes.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
		).toBe(true);
		await notes.hover();
		await page.mouse.wheel(0, 100_000);
		await expect(notes.getByText("Pagination 0", { exact: true })).toHaveCount(
			1,
		);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
}
