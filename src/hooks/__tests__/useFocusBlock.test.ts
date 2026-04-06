import { createDocumentFromMarkdown } from "@/components/editor/core/Document";
import { renderHook } from "@testing-library/react-native";
import { act } from "react";
import { useEditorState } from "../../stores/editorStore";
import { useFocusBlock } from "../useFocusBlock";

describe("useFocusBlock", () => {
	beforeEach(() => {
		useEditorState.getState().resetState();
	});

	it("clears structured selection before focusing a text block", () => {
		useEditorState.setState({
			document: createDocumentFromMarkdown("Alpha\nBeta"),
			blockSelection: { start: 0, end: 1 },
			blockSelectionAnchor: 0,
			gapSelection: { index: 1 },
			selection: null,
		});
		const { result } = renderHook(() => useFocusBlock());

		act(() => {
			result.current.focusBlockAt(1, 2);
		});

		const state = useEditorState.getState();
		expect(state.blockSelection).toBeNull();
		expect(state.blockSelectionAnchor).toBeNull();
		expect(state.gapSelection).toBeNull();
		expect(state.selection).toEqual({
			anchor: { blockIndex: 1, offset: 2 },
			focus: { blockIndex: 1, offset: 2 },
		});
	});
});
