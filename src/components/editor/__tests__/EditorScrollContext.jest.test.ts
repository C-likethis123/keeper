import { selectStickyVideoIndex } from "@/components/editor/EditorScrollContext";

describe("selectStickyVideoIndex", () => {
	it("returns null when no video block has scrolled fully past the top", () => {
		const layouts = new Map([
			[0, { y: 40, height: 180 }],
			[3, { y: 320, height: 200 }],
		]);

		expect(selectStickyVideoIndex(layouts, 100)).toBeNull();
	});

	it("returns the nearest video block above the viewport", () => {
		const layouts = new Map([
			[0, { y: 40, height: 180 }],
			[3, { y: 320, height: 200 }],
			[6, { y: 700, height: 220 }],
		]);

		expect(selectStickyVideoIndex(layouts, 600)).toBe(3);
	});

	it("ignores a video block until it has fully scrolled out of view", () => {
		const layouts = new Map([[2, { y: 200, height: 240 }]]);

		expect(selectStickyVideoIndex(layouts, 430)).toBeNull();
		expect(selectStickyVideoIndex(layouts, 440)).toBe(2);
	});
});
