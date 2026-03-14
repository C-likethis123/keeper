import { createCollapsedSelection } from "@/components/editor/core/Selection";
import { useEditorSelection, useEditorState } from "@/stores/editorStore";
import { useCallback } from "react";

interface UseFocusBlockReturn {
	focusBlockIndex: number | null;
	focusBlock: (index: number) => void;
	focusBlockAt: (index: number, offset: number) => void;
	blurBlock: () => void;
}

export function useFocusBlock(): UseFocusBlockReturn {
	const selection = useEditorSelection();
	const setSelection = useEditorState((s) => s.setSelection);
	const focusBlockAt = useCallback(
		(index: number, offset: number) => {
			const document = useEditorState.getState().document;
			const block = document.blocks[index];
			const nextOffset = Math.max(0, Math.min(offset, block?.content.length ?? 0));
			setSelection(
				createCollapsedSelection({ blockIndex: index, offset: nextOffset }),
			);
		},
		[setSelection],
	);
	const focusBlock = useCallback(
		(index: number) => {
			const document = useEditorState.getState().document;
			const block = document.blocks[index];
			const offset = block?.content.length ?? 0;
			focusBlockAt(index, offset);
		},
		[focusBlockAt],
	);

	const blurBlock = useCallback(() => {
		setSelection(null);
	}, [setSelection]);

	const focusBlockIndex = selection?.focus.blockIndex ?? null;
	return {
		focusBlockIndex,
		focusBlock,
		focusBlockAt,
		blurBlock,
	};
}
