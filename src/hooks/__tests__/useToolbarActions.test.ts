import { BlockType } from "@/components/editor/core/BlockNode";
import { createDocumentFromMarkdown } from "@/components/editor/core/Document";
import { createCollapsedSelection } from "@/components/editor/core/Selection";
import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorState } from "@/stores/editorStore";
import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useToolbarActions } from "../useToolbarActions";

const mockFocusBlock = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockCopyPickedImageToNotes = jest.fn();
const mockOpenDialog = jest.fn();
const mockCopyPickedWebImageToNotes = jest.fn();

jest.mock("@/components/editor/keyboard/editorCommands", () => ({
	executeEditorCommand: jest.fn(),
}));

jest.mock("@/components/editor/keyboard/useEditorCommandContext", () => ({
	useEditorCommandContext: () => ({ mocked: true }),
}));

jest.mock("../useFocusBlock", () => ({
	useFocusBlock: () => ({
		focusBlock: (...args: unknown[]) => mockFocusBlock(...args),
		focusBlockAt: jest.fn(),
		blurBlock: jest.fn(),
	}),
}));

jest.mock("expo-document-picker", () => ({
	getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("@/services/notes/imageStorage", () => ({
	copyPickedImageToNotes: (...args: unknown[]) =>
		mockCopyPickedImageToNotes(...args),
}));

jest.mock("@tauri-apps/plugin-dialog", () => ({
	open: (...args: unknown[]) => mockOpenDialog(...args),
}));

jest.mock("@/services/notes/imageStorage.web", () => ({
	copyPickedImageToNotes: (...args: unknown[]) =>
		mockCopyPickedWebImageToNotes(...args),
}));

describe("useToolbarActions", () => {
	const originalPlatform = Platform.OS;
	const mockExecuteEditorCommand = jest.mocked(executeEditorCommand);

	beforeEach(() => {
		jest.clearAllMocks();
		useEditorState.getState().resetState();
		useEditorState.setState({
			document: createDocumentFromMarkdown("Hello"),
			selection: createCollapsedSelection({ blockIndex: 0, offset: 5 }),
		});
		Object.defineProperty(Platform, "OS", {
			configurable: true,
			value: "ios",
		});
	});

	afterAll(() => {
		Object.defineProperty(Platform, "OS", {
			configurable: true,
			value: originalPlatform,
		});
	});

	it("dispatches indent and outdent editor commands", () => {
		const { result } = renderHook(() => useToolbarActions());

		act(() => {
			result.current.handleIndent();
			result.current.handleOutdent();
		});

		expect(mockExecuteEditorCommand).toHaveBeenNthCalledWith(
			1,
			"indentListItem",
			{ mocked: true },
		);
		expect(mockExecuteEditorCommand).toHaveBeenNthCalledWith(
			2,
			"outdentListItem",
			{ mocked: true },
		);
	});

	it("converts the focused block to a checkbox and refocuses it", () => {
		jest.useFakeTimers();
		const { result } = renderHook(() => useToolbarActions());

		act(() => {
			result.current.handleConvertToCheckbox();
		});
		act(() => {
			jest.runOnlyPendingTimers();
		});

		expect(useEditorState.getState().document.blocks[0]?.type).toBe(
			BlockType.checkboxList,
		);
		expect(mockFocusBlock).toHaveBeenCalledWith(0);
		jest.useRealTimers();
	});

	it("does nothing when the focused block is already a checkbox", () => {
		useEditorState.setState({
			document: createDocumentFromMarkdown("- [ ] Done"),
			selection: createCollapsedSelection({ blockIndex: 0, offset: 4 }),
		});

		const { result } = renderHook(() => useToolbarActions());

		act(() => {
			result.current.handleConvertToCheckbox();
		});

		expect(useEditorState.getState().document.blocks[0]?.type).toBe(
			BlockType.checkboxList,
		);
		expect(mockFocusBlock).not.toHaveBeenCalled();
	});

	it("skips native image insertion on web", async () => {
		Object.defineProperty(Platform, "OS", {
			configurable: true,
			value: "web",
		});
		mockOpenDialog.mockResolvedValue(null);

		const { result } = renderHook(() => useToolbarActions());

		await act(async () => {
			await result.current.handleInsertImage();
		});

		expect(mockGetDocumentAsync).not.toHaveBeenCalled();
		expect(mockOpenDialog).toHaveBeenCalled();
		expect(mockCopyPickedWebImageToNotes).not.toHaveBeenCalled();
		expect(useEditorState.getState().document.blocks).toHaveLength(1);
	});

	it("inserts an image block after the focused block on native", async () => {
		mockGetDocumentAsync.mockResolvedValue({
			canceled: false,
			assets: [{ uri: "file:///tmp/image.png" }],
		});
		mockCopyPickedImageToNotes.mockResolvedValue("notes/image.png");
		const { result } = renderHook(() => useToolbarActions());

		await act(async () => {
			await result.current.handleInsertImage();
		});

		expect(mockGetDocumentAsync).toHaveBeenCalledWith({
			type: "image/*",
			copyToCacheDirectory: true,
		});
		expect(mockCopyPickedImageToNotes).toHaveBeenCalledWith(
			"file:///tmp/image.png",
		);
		expect(useEditorState.getState().document.blocks[1]).toMatchObject({
			type: BlockType.image,
			content: "notes/image.png",
		});
		expect(mockFocusBlock).toHaveBeenCalledWith(1);
	});

	it("inserts a table after the last focused block when toolbar press clears focus", () => {
		useEditorState.setState({
			document: createDocumentFromMarkdown("First\n\nSecond"),
			selection: createCollapsedSelection({ blockIndex: 2, offset: 6 }),
		});
		const { result } = renderHook(() => useToolbarActions());

		act(() => {
			useEditorState.getState().setSelection(null);
		});
		act(() => {
			result.current.handleInsertTable(2, 3);
		});

		const blocks = useEditorState.getState().document.blocks;
			expect(blocks).toHaveLength(5);
			expect(blocks[3]).toMatchObject({
				type: BlockType.table,
				attributes: {
					headerRow: true,
				tableData: [
					["", "", ""],
					["", "", ""],
					],
				},
			});
			expect(blocks[4]).toMatchObject({
				type: BlockType.paragraph,
				content: "",
			});
			expect(mockFocusBlock).toHaveBeenCalledWith(3);
		});
});
