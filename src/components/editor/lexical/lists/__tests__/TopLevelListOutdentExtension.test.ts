import {
	$createListItemNode,
	$createListNode,
	ListItemNode,
	ListNode,
} from "@lexical/list";
import {
	$createTextNode,
	$getRoot,
	createEditor,
	OUTDENT_CONTENT_COMMAND,
	ParagraphNode,
} from "lexical";
import {
	$outdentTopLevelListItems,
	registerTopLevelListOutdent,
} from "../TopLevelListOutdentExtension";

function createListItem(text: string) {
	const textNode = $createTextNode(text);
	const item = $createListItemNode().append(textNode);
	return { item, textNode };
}

describe("TopLevelListOutdentExtension", () => {
	it("turns selected top-level list item into paragraph", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		let handled = false;

		editor.update(
			() => {
				const first = createListItem("first");
				const selected = createListItem("selected");
				const last = createListItem("last");
				$getRoot().append(
					$createListNode("bullet").append(
						first.item,
						selected.item,
						last.item,
					),
				);
				selected.textNode.select(0, 0);
				handled = $outdentTopLevelListItems();
			},
			{ discrete: true },
		);

		expect(handled).toBe(true);
		editor.getEditorState().read(() => {
			const children = $getRoot().getChildren();
			expect(children.map((node) => node.getType())).toEqual([
				"list",
				"paragraph",
				"list",
			]);
			expect(children.map((node) => node.getTextContent())).toEqual([
				"first",
				"selected",
				"last",
			]);
			expect(children[1]).toBeInstanceOf(ParagraphNode);
		});
	});

	it("leaves nested item for normal outdent handling", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		let handled = true;

		editor.update(
			() => {
				const parent = createListItem("parent");
				const nested = createListItem("nested");
				parent.item.append($createListNode("bullet").append(nested.item));
				$getRoot().append($createListNode("bullet").append(parent.item));
				nested.textNode.select(0, 0);
				handled = $outdentTopLevelListItems();
			},
			{ discrete: true },
		);

		expect(handled).toBe(false);
		editor.getEditorState().read(() => {
			expect($getRoot().getFirstChild()?.getType()).toBe("list");
			expect($getRoot().getTextContent()).toBe("parentnested");
		});
	});

	it("handles command used by toolbar and Shift+Tab", () => {
		const editor = createEditor({ nodes: [ListNode, ListItemNode] });
		const unregister = registerTopLevelListOutdent(editor);

		editor.update(
			() => {
				const selected = createListItem("selected");
				$getRoot().append($createListNode("bullet").append(selected.item));
				selected.textNode.select(0, 0);
			},
			{ discrete: true },
		);

		expect(editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)).toBe(
			true,
		);
		editor.update(() => {}, { discrete: true });
		editor.getEditorState().read(() => {
			expect($getRoot().getFirstChild()?.getType()).toBe("paragraph");
		});

		unregister();
	});
});
