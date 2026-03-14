import type { DocumentSelection } from "@/components/editor/core/Selection";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorState } from "@/stores/editorStore";
import { useCallback } from "react";
import { getVerticalNavigationTarget } from "./verticalNavigation";

interface OffsetSelection {
	start: number;
	end: number;
}

function toDocumentSelection(
	blockIndex: number,
	selection: DocumentSelection | OffsetSelection | null,
): DocumentSelection | null {
	if (!selection) return null;
	if ("anchor" in selection && "focus" in selection) {
		return selection;
	}
	return {
		anchor: { blockIndex, offset: selection.start },
		focus: { blockIndex, offset: selection.end },
	};
}

export function useVerticalArrowNavigation(
	blockIndex: number,
	selection: DocumentSelection | OffsetSelection | null,
) {
	const document = useEditorState((state) => state.document);
	const { focusBlockAt } = useFocusBlock();

	return useCallback(
		(key: string) => {
			if (key !== "ArrowUp" && key !== "ArrowDown") {
				return false;
			}

			const target = getVerticalNavigationTarget({
				direction: key === "ArrowUp" ? "up" : "down",
				document,
				blockIndex,
				selection: toDocumentSelection(blockIndex, selection),
			});
			if (!target) return false;

			focusBlockAt(target.blockIndex, target.offset);
			return true;
		},
		[blockIndex, document, focusBlockAt, selection],
	);
}
