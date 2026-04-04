import { blockRegistry } from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";

describe("blockRegistry.detectBlockType — collapsible variants", () => {
	it("detects <details> alone", () => {
		const result = blockRegistry.detectBlockType("<details>");
		expect(result?.type).toBe(BlockType.collapsibleBlock);
		expect(result?.remainingContent).toBe("");
	});

	it("detects <details></details>", () => {
		const result = blockRegistry.detectBlockType("<details></details>");
		expect(result?.type).toBe(BlockType.collapsibleBlock);
		expect(result?.remainingContent).toBe("");
	});

	it("detects <details open>", () => {
		const result = blockRegistry.detectBlockType("<details open>");
		expect(result?.type).toBe(BlockType.collapsibleBlock);
		expect(result?.remainingContent).toBe("");
	});

	it("detects <details open></details>", () => {
		const result = blockRegistry.detectBlockType("<details open></details>");
		expect(result?.type).toBe(BlockType.collapsibleBlock);
		expect(result?.remainingContent).toBe("");
	});

	it("does not detect a partial or mid-string details tag", () => {
		expect(blockRegistry.detectBlockType("some <details> text")).toBeNull();
		expect(blockRegistry.detectBlockType("<details>extra")).toBeNull();
		expect(blockRegistry.detectBlockType("<details open>extra")).toBeNull();
	});
});
