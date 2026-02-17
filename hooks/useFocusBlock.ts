import { createCollapsedSelection } from "@/components/editor/core/Selection";
import { useEditorState } from "@/contexts/EditorContext";
import { useCallback } from "react";

export interface UseFocusBlockReturn {
	focusBlockIndex: number | null;
	focusBlock: (index: number) => void;
	blurBlock: () => void;
}

export function useFocusBlock(): UseFocusBlockReturn {
	const editorState = useEditorState();

	const focusBlock = useCallback(
		(index: number) => {
			const block = editorState.document.blocks[index];
			const offset = block?.content.length ?? 0;
			editorState.setSelection(
				createCollapsedSelection({ blockIndex: index, offset }),
			);
		},
		[editorState],
	);

	const blurBlock = useCallback(() => {
		editorState.setSelection(null);
	}, [editorState]);

	const focusBlockIndex = editorState.getFocusedBlockIndex();
	return {
		focusBlockIndex,
		focusBlock,
		blurBlock,
	};
}
