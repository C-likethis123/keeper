import { $isCodeNode } from "@lexical/code";
import { $getSelection, $isRangeSelection } from "lexical";

export function $isSelectionInCodeBlock(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }

  return $isCodeNode(selection.anchor.getNode().getTopLevelElement());
}
