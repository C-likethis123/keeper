import { useBlockInputHandlers } from "@/components/editor/blocks/useBlockInputHandlers";
import { act, renderHook } from "@testing-library/react-native";

const mockFocusBlock = jest.fn();
const mockHandleVerticalArrow = jest.fn(() => false);

jest.mock("@/hooks/useFocusBlock", () => ({
	useFocusBlock: () => ({ focusBlock: mockFocusBlock }),
}));

jest.mock("@/stores/editorStore", () => ({
	useEditorBlockSelection: () => ({ start: 0, end: 0 }),
}));

jest.mock("@/components/editor/keyboard/useVerticalArrowNavigation", () => ({
	useVerticalArrowNavigation: () => mockHandleVerticalArrow,
}));

describe("useBlockInputHandlers", () => {
	const baseProps = {
		index: 2,
		isFocused: false,
		onEnter: jest.fn(),
		onBackspaceAtStart: jest.fn(),
		onSelectionChange: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockHandleVerticalArrow.mockReturnValue(false);
	});

	it("returns handleFocus, handleKeyPress, handleSelectionChange", () => {
		const { result } = renderHook(() => useBlockInputHandlers(baseProps));

		expect(typeof result.current.handleFocus).toBe("function");
		expect(typeof result.current.handleKeyPress).toBe("function");
		expect(typeof result.current.handleSelectionChange).toBe("function");
	});

	it("calls onSelectionChange with index and coordinates on selection event", () => {
		const onSelectionChange = jest.fn();
		const { result } = renderHook(() =>
			useBlockInputHandlers({ ...baseProps, onSelectionChange }),
		);

		act(() => {
			result.current.handleSelectionChange({
				nativeEvent: { selection: { start: 3, end: 7 } },
			} as never);
		});

		expect(onSelectionChange).toHaveBeenCalledWith(2, 3, 7);
	});

	it("calls onBackspaceAtStart when Backspace pressed at position 0", () => {
		const onBackspaceAtStart = jest.fn();
		const { result } = renderHook(() =>
			useBlockInputHandlers({ ...baseProps, onBackspaceAtStart }),
		);

		act(() => {
			result.current.handleKeyPress({
				nativeEvent: { key: "Backspace" },
			} as never);
		});

		expect(onBackspaceAtStart).toHaveBeenCalledWith(2);
	});
});
