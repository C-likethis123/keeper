import {
	$getSelection,
	$isRangeSelection,
	defineExtension,
	HISTORY_PUSH_TAG,
} from "lexical";

export const InlineCodeMarkdownExitExtension = defineExtension({
	name: "keeper/InlineCodeMarkdownExit",
	register(editor) {
		return editor.registerUpdateListener(({ tags }) => {
			if (!tags.has(HISTORY_PUSH_TAG)) {
				return;
			}

			editor.update(() => {
				const selection = $getSelection();
				if (
					!$isRangeSelection(selection) ||
					!selection.isCollapsed() ||
					!selection.hasFormat("code")
				) {
					return;
				}

				selection.toggleFormat("code");
			});
		});
	},
});
