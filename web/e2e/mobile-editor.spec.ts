import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function visibleViewport(page: Page, height: number, top = 0) {
	await page.evaluate(
		({ height, top }) => {
			window.dispatchEvent(
				new CustomEvent("test-viewport", { detail: { height, top } }),
			);
		},
		{ height, top },
	);
}

async function expectCaretVisible(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(() => {
				const selection = window.getSelection();
				if (!selection?.focusNode) return false;
				const range = document.createRange();
				range.setStart(selection.focusNode, selection.focusOffset);
				range.collapse(true);
				const caret = range.getBoundingClientRect();
				const scroller = document
					.querySelector(".keeper-editor-scroller")
					?.getBoundingClientRect();
				const toolbar = document
					.querySelector(".keeper-toolbar-sticky")
					?.getBoundingClientRect();
				return (
					!!scroller &&
					!!toolbar &&
					caret.top >= toolbar.bottom &&
					caret.bottom <=
						Math.min(
							scroller.bottom,
							(window.visualViewport?.offsetTop ?? 0) +
								(window.visualViewport?.height ?? window.innerHeight),
						) -
							10
				);
			}),
		)
		.toBe(true);
}

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => {
		const viewport = new EventTarget();
		let height: number | undefined;
		let top = 0;
		Object.defineProperties(viewport, {
			height: { get: () => height ?? window.innerHeight },
			offsetTop: { get: () => top },
			scale: { get: () => 1 },
		});
		Object.defineProperty(window, "visualViewport", {
			value: viewport,
			configurable: true,
		});
		window.addEventListener("test-viewport", (event) => {
			const detail = (event as CustomEvent<{ height: number; top: number }>)
				.detail;
			height = detail.height;
			top = detail.top;
			viewport.dispatchEvent(new Event("resize"));
		});
	});
	await page.goto("/");
});

test("full editor follows keyboard area, caret, and deliberate reading scroll", async ({
	page,
}) => {
	await page.getByRole("button", { name: "Take a note" }).click();
	await page.getByLabel("Note title").fill("Mobile viewport");
	await page.getByRole("button", { name: "Close note" }).click();
	const editor = page.getByLabel("Note content");
	await editor.fill(
		Array.from({ length: 40 }, (_, index) => `Line ${index}`).join("\n\n"),
	);
	await editor.press("ControlOrMeta+End");
	await visibleViewport(page, 360);
	await editor.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.insertText("Final line");
	await expectCaretVisible(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	const scroller = page.locator(".keeper-editor-scroller");
	const before = await scroller.evaluate((element) => element.scrollTop);
	expect(before).toBeGreaterThan(0);
	await scroller.evaluate((element) => {
		element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
		element.scrollTop -= 100;
	});
	const reading = await scroller.evaluate((element) => element.scrollTop);
	await visibleViewport(page, 320);
	await page.waitForTimeout(100);
	expect(
		Math.abs(
			(await scroller.evaluate((element) => element.scrollTop)) - reading,
		),
	).toBeLessThanOrEqual(2);
	await scroller.evaluate((element) => {
		element.dispatchEvent(new Event("touchmove"));
		element.scrollTop -= 200;
	});
	const touchReading = await scroller.evaluate((element) => element.scrollTop);
	await visibleViewport(page, 300, 20);
	await page.waitForTimeout(100);
	expect(
		Math.abs(
			(await scroller.evaluate((element) => element.scrollTop)) - touchReading,
		),
	).toBeLessThanOrEqual(2);
	await page.keyboard.insertText(" resumed");
	await expectCaretVisible(page);
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(editor).toBeFocused();
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await expect(editor).toBeFocused();
	await expectCaretVisible(page);
	await editor.press("ArrowUp");
	await expectCaretVisible(page);
	await editor.press("Shift+ArrowLeft");
	await expectCaretVisible(page);
	await page.setViewportSize({ width: 844, height: 390 });
	await visibleViewport(page, 260);
	await editor.press("ArrowDown");
	await expectCaretVisible(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await visibleViewport(page, 844);
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("Final line resumed");
	await expect(page.locator(".editor-page")).toHaveAttribute(
		"data-keyboard-limited",
		"false",
	);
	expect(
		await page
			.locator(".editor-page")
			.evaluate((element) => getComputedStyle(element).position),
	).not.toBe("fixed");
	await expect(editor).toHaveCount(1);
});

test("embedded composer reaches final line with keyboard open", async ({
	page,
}) => {
	await page.getByRole("button", { name: "Take a note" }).click();
	const editor = page.getByLabel("Note content");
	await editor.fill(
		Array.from({ length: 20 }, (_, index) => `Embedded ${index}`).join("\n\n"),
	);
	await editor.press("ControlOrMeta+End");
	await visibleViewport(page, 300);
	await editor.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.insertText("Embedded final");
	await expectCaretVisible(page);
	await expect(
		page.getByRole("button", { name: "Close note" }),
	).toBeInViewport();
	await visibleViewport(page, 844);
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("Embedded final");
});

test("video minimizes without replacing player or losing editor selection", async ({
	page,
}) => {
	await page.route("**/*youtube*/**", (route) => route.abort());
	await page.getByRole("button", { name: "Take a note" }).click();
	await page.getByLabel("Note title").fill("Mobile video");
	await page.getByRole("button", { name: "Close note" }).click();
	await page.getByRole("button", { name: "Attach video" }).click();
	await page
		.getByPlaceholder("https://www.youtube.com/watch?v=...")
		.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	const player = page.locator(".browser-editor-panel iframe");
	await expect(player).toHaveCount(1);
	const handle = await player.elementHandle();
	const editor = page.getByLabel("Note content");
	await editor.fill(`${"Video line\n\n".repeat(25)}Video notes`);
	await editor.press("End");
	const selection = () =>
		page.evaluate(() => ({
			text: window.getSelection()?.focusNode?.textContent,
			offset: window.getSelection()?.focusOffset,
		}));
	const before = await selection();
	await visibleViewport(page, 320);
	const expand = page.getByRole("button", { name: "Expand video" });
	await expect(expand).toBeVisible();
	await expect(page.locator(".browser-editor-panel")).toHaveAttribute(
		"data-minimized",
		"true",
	);
	await expectCaretVisible(page);
	await expand.click();
	await expect(editor).toBeFocused();
	expect(await selection()).toEqual(before);
	await page.getByRole("button", { name: "Minimize video" }).click();
	await visibleViewport(page, 844);
	await expect(
		page.getByRole("button", { name: "Minimize video" }),
	).toBeVisible();
	expect(
		await handle?.evaluate(
			(element) =>
				element === document.querySelector(".browser-editor-panel iframe"),
		),
	).toBe(true);
	await expect(editor).toContainText("Video notes");
});
