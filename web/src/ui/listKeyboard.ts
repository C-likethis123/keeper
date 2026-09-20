import { $createListNode, $isListItemNode, $isListNode, ListItemNode, type ListNode } from "@lexical/list";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
	$createParagraphNode,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	INDENT_CONTENT_COMMAND,
	KEY_TAB_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	type LexicalEditor,
	type LexicalNode,
} from "lexical";

function moveListItemToParagraph(listItem: ListItemNode): LexicalNode[] {
	const paragraph = $createParagraphNode()
		.setTextFormat(listItem.getTextFormat())
		.setTextStyle(listItem.getTextStyle());
	const nestedLists: ListNode[] = [];
	for (const child of listItem.getChildren()) {
		if ($isListNode(child)) nestedLists.push(child);
		else paragraph.append(child);
	}
	return [paragraph, ...nestedLists];
}

/** Converts selected top-level list items to paragraphs; nested items use Lexical's normal outdent. */
export function $outdentTopLevelListItems() {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return false;
	const selectedItems = new Map<string, ListItemNode>();
	for (const node of selection.getNodes()) {
		const item = $getNearestNodeOfType(node, ListItemNode);
		if (item) selectedItems.set(item.getKey(), item);
	}
	if (selectedItems.size === 0 || [...selectedItems.values()].some((item) => item.getIndent() > 0)) return false;
	const selectedKeys = new Set(selectedItems.keys());
	const lists = new Map<string, ListNode>();
	for (const item of selectedItems.values()) {
		const parent = item.getParent();
		if ($isListNode(parent)) lists.set(parent.getKey(), parent);
	}
	for (const list of lists.values()) {
		const replacements: LexicalNode[] = [];
		let remaining: ListItemNode[] = [];
		const flush = () => {
			if (!remaining.length) return;
			const replacement = $createListNode(list.getListType(), remaining[0].getValue());
			replacement.append(...remaining);
			replacements.push(replacement);
			remaining = [];
		};
		for (const child of list.getChildren()) {
			if ($isListItemNode(child) && selectedKeys.has(child.getKey())) {
				flush();
				replacements.push(...moveListItemToParagraph(child));
			} else if ($isListItemNode(child)) remaining.push(child);
		}
		flush();
		for (const replacement of replacements) list.insertBefore(replacement);
		list.remove();
	}
	return lists.size > 0;
}

function selectionContainsListItem() {
	const selection = $getSelection();
	return $isRangeSelection(selection) && selection.getNodes().some((node) => $getNearestNodeOfType(node, ListItemNode) !== null);
}

/** Matches Keeper native behavior: Tab indents list items; Shift+Tab outdents them. */
export function registerListKeyboardBehavior(editor: LexicalEditor) {
	const removeTopLevelOutdent = editor.registerCommand(OUTDENT_CONTENT_COMMAND, $outdentTopLevelListItems, COMMAND_PRIORITY_HIGH);
	const removeTab = editor.registerCommand(KEY_TAB_COMMAND, (event) => {
		if (!selectionContainsListItem()) return false;
		event.preventDefault();
		editor.dispatchCommand(event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, undefined);
		return true;
	}, COMMAND_PRIORITY_HIGH);
	return () => { removeTopLevelOutdent(); removeTab(); };
}
