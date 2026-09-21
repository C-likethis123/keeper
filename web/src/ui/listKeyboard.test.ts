import { $createListItemNode, $createListNode, ListItemNode, ListNode } from "@lexical/list";
import { $createTextNode, $getRoot, createEditor, KEY_TAB_COMMAND, OUTDENT_CONTENT_COMMAND, ParagraphNode } from "lexical";
import { describe, expect, it, vi } from "vitest";
import { $outdentTopLevelListItems, registerListKeyboardBehavior } from "@web/ui/listKeyboard";

function createListItem(text: string) {
	const textNode = $createTextNode(text);
	return { item: $createListItemNode().append(textNode), textNode };
}

describe("Vite list keyboard behavior", () => {
	it("turns a selected top-level item into a paragraph", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		editor.update(() => {
			const first = createListItem("first");
			const selected = createListItem("selected");
			const last = createListItem("last");
			$getRoot().append($createListNode("bullet").append(first.item, selected.item, last.item));
			selected.textNode.select();
			expect($outdentTopLevelListItems()).toBe(true);
		}, { discrete: true });
		editor.getEditorState().read(() => {
			const children = $getRoot().getChildren();
			expect(children.map((node) => node.getType())).toEqual(["list", "paragraph", "list"]);
			expect(children[1]).toBeInstanceOf(ParagraphNode);
		});
	});

	it("handles the outdent command used by Shift+Tab", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		const remove = registerListKeyboardBehavior(editor);
		editor.update(() => {
			const selected = createListItem("selected");
			$getRoot().append($createListNode("bullet").append(selected.item));
			selected.textNode.select();
		}, { discrete: true });
		expect(editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)).toBe(true);
		editor.update(() => {}, { discrete: true });
		editor.getEditorState().read(() => expect($getRoot().getFirstChild()).toBeInstanceOf(ParagraphNode));
		remove();
	});

	it("captures Tab only while a list item is selected", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		const remove = registerListKeyboardBehavior(editor);
		editor.update(() => {
			const item = createListItem("selected");
			$getRoot().append($createListNode("bullet").append(item.item));
			item.textNode.select();
		}, { discrete: true });
		const preventDefault = vi.fn();
		expect(editor.dispatchCommand(KEY_TAB_COMMAND, { preventDefault, shiftKey: false } as unknown as KeyboardEvent)).toBe(true);
		expect(preventDefault).toHaveBeenCalledOnce();
		remove();
	});
});
