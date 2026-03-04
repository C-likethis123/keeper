import { createCollapsedSelection } from "@/components/editor/core/Selection";
import { useEditorSelection, useEditorState } from "@/stores/editorStore";
import { useCallback } from "react";

export interface UseFocusBlockReturn {
	focusBlockIndex: number | null;
	focusBlock: (index: number) => void;
	blurBlock: () => void;
}

export function useFocusBlock(): UseFocusBlockReturn {
	const selection = useEditorSelection();
	const setSelection = useEditorState((s) => s.setSelection);
	const focusBlock = useCallback(
		(index: number) => {
			const document = useEditorState.getState().document;
			const block = document.blocks[index];
			const offset = block?.content.length ?? 0;
			setSelection(createCollapsedSelection({ blockIndex: index, offset }));
		},
		[setSelection],
	);

	const blurBlock = useCallback(() => {
		setSelection(null);
	}, [setSelection]);

	const focusBlockIndex = selection?.focus.blockIndex ?? null;
	return {
		focusBlockIndex,
		focusBlock,
		blurBlock,
	};
}
