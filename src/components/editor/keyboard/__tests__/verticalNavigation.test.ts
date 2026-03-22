import { createCodeBlock, createParagraphBlock } from "../../core/BlockNode";
import { createEmptyDocument } from "../../core/Document";
import { createCollapsedSelection } from "../../core/Selection";
import { getVerticalNavigationTarget } from "../verticalNavigation";

describe("getVerticalNavigationTarget", () => {
	it("preserves the caret column when leaving the last line of a code block", () => {
		const document = {
			...createEmptyDocument(),
			blocks: [createCodeBlock("abc\ndef"), createParagraphBlock("xy")],
		};

		const target = getVerticalNavigationTarget({
			direction: "down",
			document,
			blockIndex: 0,
			selection: createCollapsedSelection({ blockIndex: 0, offset: 6 }),
		});

		expect(target).toEqual({
			blockIndex: 1,
			offset: 2,
		});
	});

	it("preserves the caret column when entering a code block from below", () => {
		const document = {
			...createEmptyDocument(),
			blocks: [createCodeBlock("abc\ndef"), createParagraphBlock("xy")],
		};

		const target = getVerticalNavigationTarget({
			direction: "up",
			document,
			blockIndex: 1,
			selection: createCollapsedSelection({ blockIndex: 1, offset: 1 }),
		});

		expect(target).toEqual({
			blockIndex: 0,
			offset: 5,
		});
	});
});
