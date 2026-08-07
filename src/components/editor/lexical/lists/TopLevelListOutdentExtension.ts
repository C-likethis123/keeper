import {
	$createListNode,
	$isListItemNode,
	$isListNode,
	ListItemNode,
	type ListNode,
} from "@lexical/list";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
	$createParagraphNode,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	defineExtension,
	type LexicalEditor,
	type LexicalNode,
	OUTDENT_CONTENT_COMMAND,
} from "lexical";

function moveListItemToParagraph(listItem: ListItemNode): LexicalNode[] {
	const paragraph = $createParagraphNode()
		.setTextFormat(listItem.getTextFormat())
		.setTextStyle(listItem.getTextStyle());
	const nestedLists: ListNode[] = [];

	for (const child of listItem.getChildren()) {
		if ($isListNode(child)) {
			nestedLists.push(child);
		} else {
			paragraph.append(child);
		}
	}

	return [paragraph, ...nestedLists];
}

function splitListAroundSelectedItems(
	list: ListNode,
	selectedItemKeys: ReadonlySet<string>,
) {
	const replacements: LexicalNode[] = [];
	let remainingItems: ListItemNode[] = [];

	const flushRemainingItems = () => {
		if (remainingItems.length === 0) return;

		const replacementList = $createListNode(
			list.getListType(),
			remainingItems[0].getValue(),
		);
		replacementList.append(...remainingItems);
		replacements.push(replacementList);
		remainingItems = [];
	};

	for (const child of list.getChildren()) {
		if (!$isListItemNode(child) || !selectedItemKeys.has(child.getKey())) {
			if ($isListItemNode(child)) remainingItems.push(child);
			continue;
		}

		flushRemainingItems();
		replacements.push(...moveListItemToParagraph(child));
	}

	flushRemainingItems();
	for (const replacement of replacements) list.insertBefore(replacement);
	list.remove();
}

export function $outdentTopLevelListItems(): boolean {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return false;

	const selectedItems = new Map<string, ListItemNode>();
	for (const node of selection.getNodes()) {
		const listItem = $getNearestNodeOfType(node, ListItemNode);
		if (listItem) selectedItems.set(listItem.getKey(), listItem);
	}

	if (
		selectedItems.size === 0 ||
		Array.from(selectedItems.values()).some((item) => item.getIndent() > 0)
	) {
		return false;
	}

	const lists = new Map<string, ListNode>();
	for (const item of selectedItems.values()) {
		const list = item.getParent();
		if ($isListNode(list)) lists.set(list.getKey(), list);
	}

	const selectedItemKeys = new Set(selectedItems.keys());
	for (const list of lists.values()) {
		splitListAroundSelectedItems(list, selectedItemKeys);
	}

	return lists.size > 0;
}

export function registerTopLevelListOutdent(editor: LexicalEditor) {
	return editor.registerCommand(
		OUTDENT_CONTENT_COMMAND,
		$outdentTopLevelListItems,
		COMMAND_PRIORITY_HIGH,
	);
}

export const TopLevelListOutdentExtension = defineExtension({
	name: "keeper/TopLevelListOutdent",
	register: registerTopLevelListOutdent,
});
