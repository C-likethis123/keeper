import { $createLinkNode, $isLinkNode, LinkNode } from "@lexical/link";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isElementNode,
	$isRangeSelection,
	$isTextNode,
	createEditor,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import { createWikiLinkUrl } from "../../wikilinks/wikiLinkUrl";
import { LinkMarkdownEditExtension } from "../LinkMarkdownEditExtension";

function createTestEditor() {
	const editor = createEditor({
		namespace: "KeeperLinkMarkdownEditTest",
		nodes: [LinkNode],
		onError: (error) => {
			throw error;
		},
	});
	const unregister =
		LinkMarkdownEditExtension.register?.(editor, {}, {} as never) ?? (() => {});
	return { editor, unregister };
}

function getParagraph() {
	const paragraph = $getRoot().getFirstChildOrThrow();
	if (!$isElementNode(paragraph)) {
		throw new Error("Expected paragraph");
	}
	return paragraph;
}

describe("LinkMarkdownEditExtension", () => {
	it("expands a markdown link when its label receives the caret", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const label = $createTextNode("test");
				const link = $createLinkNode("https://www.test.com").append(label);
				$getRoot().append($createParagraphNode().append(link));
				label.select(2, 2);
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			expect($getRoot().getTextContent()).toBe(
				"[test](https://www.test.com)",
			);
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.anchor.offset).toBe(3);
			}
		});

		unregister();
	});

	it("reparses edited markdown after caret leaves", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const label = $createTextNode("test");
				const link = $createLinkNode("https://old.test").append(label);
				const outside = $createTextNode(" outside");
				$getRoot().append($createParagraphNode().append(link, outside));
				label.selectEnd();
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.update(
			() => {
				const paragraph = getParagraph();
				const markdownNode = paragraph.getFirstChildOrThrow();
				if (!$isTextNode(markdownNode)) {
					throw new Error("Expected expanded markdown text");
				}
				expect(markdownNode.getTextContent()).toBe("[test](https://old.test)");
				markdownNode.setTextContent("[renamed](https://new.test)");
				paragraph.getLastChildOrThrow().selectStart();
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const link = getParagraph().getFirstChildOrThrow();
			expect($isLinkNode(link)).toBe(true);
			if ($isLinkNode(link)) {
				expect(link.getTextContent()).toBe("renamed");
				expect(link.getURL()).toBe("https://new.test");
			}
		});

		unregister();
	});

	it("expands and reparses wikilinks", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const label = $createTextNode("Project Alpha");
				const link = $createLinkNode(createWikiLinkUrl("Project Alpha")).append(
					label,
				);
				const outside = $createTextNode(" outside");
				$getRoot().append($createParagraphNode().append(link, outside));
				label.select(3, 3);
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			expect($getRoot().getTextContent()).toBe("[[Project Alpha]] outside");
		});

		editor.update(
			() => {
				const paragraph = getParagraph();
				paragraph.getLastChildOrThrow().selectStart();
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const link = getParagraph().getFirstChildOrThrow();
			expect($isLinkNode(link)).toBe(true);
			if ($isLinkNode(link)) {
				expect(link.getURL()).toBe(createWikiLinkUrl("Project Alpha"));
			}
		});

		unregister();
	});
});
