import { selectStickyVideoIndex } from "@/components/editor/EditorScrollContext";

describe("selectStickyVideoIndex", () => {
	it("returns null when no video block has started scrolling past the top", () => {
		const layouts = new Map([
			[0, { y: 40, height: 180 }],
			[3, { y: 320, height: 200 }],
		]);

		expect(selectStickyVideoIndex(layouts, 40)).toBeNull();
	});

	it("returns the nearest video block above the viewport", () => {
		const layouts = new Map([
			[0, { y: 40, height: 180 }],
			[3, { y: 320, height: 200 }],
			[6, { y: 700, height: 220 }],
		]);

		expect(selectStickyVideoIndex(layouts, 600)).toBe(3);
	});

	it("sticks a video block as soon as any part of it scrolls above the viewport", () => {
		const layouts = new Map([[2, { y: 200, height: 240 }]]);

		expect(selectStickyVideoIndex(layouts, 200)).toBeNull();
		expect(selectStickyVideoIndex(layouts, 201)).toBe(2);
	});
});
