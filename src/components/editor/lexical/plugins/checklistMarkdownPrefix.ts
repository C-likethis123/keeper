import {
	$isListItemNode,
	$isListNode,
	ListItemNode,
} from "@lexical/list";
import { $isTextNode, type LexicalEditor, type LexicalNode } from "lexical";

export function registerChecklistMarkdownPrefixTransform(editor: LexicalEditor) {
	return editor.registerNodeTransform(ListItemNode, (listItem) => {
		const parent = listItem.getParent();
		if (!$isListNode(parent) || parent.getListType() === "check") {
			return;
		}

		if (!$isListItemNode(listItem)) {
			return;
		}

		const firstChild: LexicalNode | null = listItem.getFirstChild();
		if (!$isTextNode(firstChild)) {
			return;
		}

		const match = firstChild.getTextContent().match(/^\[( |x|X)\]\s+/);
		if (!match) {
			return;
		}

		parent.setListType("check");
		listItem.setChecked(match[1]?.toLowerCase() === "x");
		firstChild.spliceText(0, match[0].length, "");
	});
}
