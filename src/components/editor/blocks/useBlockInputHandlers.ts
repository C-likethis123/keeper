import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection } from "@/stores/editorStore";
import { useCallback } from "react";
import type {
	NativeSyntheticEvent,
	TextInputKeyPressEventData,
	TextInputSelectionChangeEventData,
} from "react-native";
import type { BlockConfig } from "./BlockRegistry";

export function useBlockInputHandlers({
	index,
	isFocused,
	onEnter,
	onBackspaceAtStart,
	onSelectionChange,
}: {
	index: number;
	isFocused: boolean;
	onEnter: BlockConfig["onEnter"];
	onBackspaceAtStart: BlockConfig["onBackspaceAtStart"];
	onSelectionChange: BlockConfig["onSelectionChange"];
}) {
	const { focusBlock } = useFocusBlock();
	const selection = useEditorBlockSelection(index);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selection);

	const handleFocus = useCallback(() => {
		if (isFocused) return;
		focusBlock(index);
	}, [focusBlock, index, isFocused]);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (handleVerticalArrow(key)) return;
			if (key === "Enter" && selection && selection.start === selection.end) {
				onEnter(index, selection.end);
			}
			if (key === "Backspace" && selection?.start === 0 && selection?.end === 0) {
				onBackspaceAtStart(index);
			}
		},
		[handleVerticalArrow, index, onBackspaceAtStart, onEnter, selection],
	);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			onSelectionChange(
				index,
				e.nativeEvent.selection.start,
				e.nativeEvent.selection.end,
			);
		},
		[index, onSelectionChange],
	);

	return { handleFocus, handleKeyPress, handleSelectionChange, selection };
}
