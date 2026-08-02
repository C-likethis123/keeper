import {
	$getSelection,
	$isRangeSelection,
	$isTextNode,
	COMMAND_PRIORITY_LOW,
	defineExtension,
	HISTORY_PUSH_TAG,
	SELECTION_CHANGE_COMMAND,
} from "lexical";

function clearInlineCodeFormat() {
	const selection = $getSelection();
	if (
		!$isRangeSelection(selection) ||
		!selection.isCollapsed() ||
		!selection.hasFormat("code")
	) {
		return;
	}

	selection.toggleFormat("code");
}

function clearInlineCodeFormatAtBlockEnd() {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
		return;
	}

	const anchorNode = selection.anchor.getNode();
	if (
		!$isTextNode(anchorNode) ||
		!anchorNode.hasFormat("code") ||
		selection.anchor.offset !== anchorNode.getTextContentSize() ||
		anchorNode.getNextSibling() !== null
	) {
		return;
	}

	clearInlineCodeFormat();
}

export const InlineCodeMarkdownExitExtension = defineExtension({
	name: "keeper/InlineCodeMarkdownExit",
	register(editor) {
		const unregisterUpdateListener = editor.registerUpdateListener(({ tags }) => {
			if (!tags.has(HISTORY_PUSH_TAG)) {
				return;
			}

			editor.update(() => {
				clearInlineCodeFormat();
			});
		});
		const unregisterSelectionChange = editor.registerCommand(
			SELECTION_CHANGE_COMMAND,
			() => {
				clearInlineCodeFormatAtBlockEnd();
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		return () => {
			unregisterUpdateListener();
			unregisterSelectionChange();
		};
	},
});
