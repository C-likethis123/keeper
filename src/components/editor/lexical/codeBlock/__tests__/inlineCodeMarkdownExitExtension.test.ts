import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	createEditor,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import { InlineCodeMarkdownExitExtension } from "../InlineCodeMarkdownExitExtension";

describe("InlineCodeMarkdownExitExtension", () => {
	it("clears inline code format when caret returns to end of final code span", () => {
		const editor = createEditor({
			namespace: "KeeperInlineCodeMarkdownExitTest",
			onError: (error) => {
				throw error;
			},
		});
		const unregister =
			InlineCodeMarkdownExitExtension.register?.(editor, {}, {} as never) ??
			(() => {});

		editor.update(
			() => {
				const code = $createTextNode("test");
				code.toggleFormat("code");
				$getRoot().append($createParagraphNode().append(code));
				code.selectEnd();
				const selection = $getSelection();
				if ($isRangeSelection(selection) && !selection.hasFormat("code")) {
					selection.toggleFormat("code");
				}
			},
			{ discrete: true },
		);
		editor.getEditorState().read(() => {
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.anchor.offset).toBe(4);
				expect(selection.hasFormat("code")).toBe(true);
			}
		});

		editor.update(
			() => editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined),
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.hasFormat("code")).toBe(false);
			}
		});

		unregister();
	});

	it("keeps inline code format when caret remains inside code span", () => {
		const editor = createEditor({
			namespace: "KeeperInlineCodeEditTest",
			onError: (error) => {
				throw error;
			},
		});
		const unregister =
			InlineCodeMarkdownExitExtension.register?.(editor, {}, {} as never) ??
			(() => {});

		editor.update(
			() => {
				const code = $createTextNode("test");
				code.toggleFormat("code");
				$getRoot().append($createParagraphNode().append(code));
				code.select(2, 2);
				const selection = $getSelection();
				if ($isRangeSelection(selection) && !selection.hasFormat("code")) {
					selection.toggleFormat("code");
				}
			},
			{ discrete: true },
		);

		editor.update(
			() => editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined),
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.hasFormat("code")).toBe(true);
			}
		});

		unregister();
	});
});
