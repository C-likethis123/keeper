import { screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { useEditorState } from "@/stores/editorStore";
import { BlockType, getCollapsibleSummary } from "@/components/editor/core/BlockNode";
import { renderEditor, resetHybridEditorHarness } from "./HybridEditorWikiLinkTestUtils";

describe("CollapsibleBlock Integration", () => {
	beforeEach(() => {
		resetHybridEditorHarness("ios");
	});

	it("focuses body on Enter in summary", async () => {
		const markdown = `<details open>\n<summary>Hello World</summary>\n\nBody\n\n</details>`;
		renderEditor(markdown);

		// Focus the block
		act(() => {
			useEditorState.getState().setSelection({
				anchor: { blockIndex: 0, offset: 0 },
				focus: { blockIndex: 0, offset: 0 },
			});
		});

		let summaryInput: any;
		await waitFor(() => {
			summaryInput = screen.getByDisplayValue("Hello World");
		});

		// Press Enter in summary
		fireEvent(summaryInput, "keyPress", { nativeEvent: { key: "Enter" } });

		// Verify block structure didn't change (no split)
		const blocks = useEditorState.getState().document.blocks;
		expect(blocks).toHaveLength(1);
		expect(blocks[0].type).toBe(BlockType.collapsibleBlock);
		expect(getCollapsibleSummary(blocks[0])).toBe("Hello World");
		expect(blocks[0].content).toBe("Body"); // Should NOT have a newline added at the start
	});

	it("splits body on empty line on Enter", async () => {
		const markdown = `<details open>\n<summary>Title</summary>\n\nLine 1\n\n</details>`;
		renderEditor(markdown);

		// Manually add a newline to simulate pressing Enter once at the end of "Line 1"
		act(() => {
			useEditorState.getState().updateBlockContent(0, "Line 1\n", 7);
		});

		let bodyInput: any;
		await waitFor(() => {
			bodyInput = screen.getByDisplayValue("Line 1\n");
		});

		// Simulate cursor at "Line 1\n|" (offset 7)
		fireEvent(bodyInput, "selectionChange", {
			nativeEvent: { selection: { start: 7, end: 7 } },
		});

		// Press Enter on the empty line
		fireEvent(bodyInput, "keyPress", { nativeEvent: { key: "Enter" } });

		const blocks = useEditorState.getState().document.blocks;
		
		expect(blocks).toHaveLength(2);
		expect(blocks[0].type).toBe(BlockType.collapsibleBlock);
		expect(blocks[0].content).toBe("Line 1"); // Should be trimmed by handleEnter in HybridEditor
		
		expect(blocks[1].type).toBe(BlockType.paragraph);
		expect(blocks[1].content).toBe("");
	});

	it("deletes empty collapsible block on backspace in empty summary", async () => {
		const markdown = `<details open>\n<summary></summary>\n\n\n\n</details>`;
		renderEditor(markdown);

		// Focus the block
		act(() => {
			useEditorState.getState().setSelection({
				anchor: { blockIndex: 0, offset: 0 },
				focus: { blockIndex: 0, offset: 0 },
			});
		});

		let summaryInput: any;
		await waitFor(() => {
			summaryInput = screen.getByPlaceholderText("Section title...");
		});

		// Press Backspace
		fireEvent(summaryInput, "keyPress", { nativeEvent: { key: "Backspace" } });

		const blocks = useEditorState.getState().document.blocks;
		
		expect(blocks).toHaveLength(1);
		expect(blocks[0].type).toBe(BlockType.paragraph);
		expect(blocks[0].content).toBe("");
	});

	it("does NOT delete collapsible block on backspace if body is not empty", async () => {
		const markdown = `<details open>\n<summary></summary>\n\nNot empty body\n\n</details>`;
		renderEditor(markdown);

		// Focus the block
		act(() => {
			useEditorState.getState().setSelection({
				anchor: { blockIndex: 0, offset: 0 },
				focus: { blockIndex: 0, offset: 0 },
			});
		});

		let summaryInput: any;
		await waitFor(() => {
			summaryInput = screen.getByPlaceholderText("Section title...");
		});

		// Press Backspace
		fireEvent(summaryInput, "keyPress", { nativeEvent: { key: "Backspace" } });

		const blocks = useEditorState.getState().document.blocks;
		
		expect(blocks).toHaveLength(1);
		expect(blocks[0].type).toBe(BlockType.collapsibleBlock);
		expect(blocks[0].content).toBe("Not empty body");
	});
});
