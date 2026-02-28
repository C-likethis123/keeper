import { createCollapsedSelection } from "@/components/editor/core/Selection";
import {
	useEditorDocument,
	useEditorSelection,
	useEditorState,
} from "@/stores/editorStore";
import { useCallback } from "react";

export interface UseFocusBlockReturn {
	focusBlockIndex: number | null;
	focusBlock: (index: number) => void;
	blurBlock: () => void;
}

export function useFocusBlock(): UseFocusBlockReturn {
	const document = useEditorDocument();
	const selection = useEditorSelection();
	const setSelection = useEditorState((s) => s.setSelection);

	const focusBlock = useCallback(
		(index: number) => {
			const block = document.blocks[index];
			const offset = block?.content.length ?? 0;
			setSelection(createCollapsedSelection({ blockIndex: index, offset }));
		},
		[document, setSelection],
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
