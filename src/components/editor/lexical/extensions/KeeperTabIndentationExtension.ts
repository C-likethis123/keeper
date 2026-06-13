import {
	COMMAND_PRIORITY_EDITOR,
	defineExtension,
	INDENT_CONTENT_COMMAND,
	KEY_TAB_COMMAND,
	OUTDENT_CONTENT_COMMAND,
} from "lexical";

export const KeeperTabIndentationExtension = defineExtension({
	name: "keeper/TabIndentation",
	register(editor) {
		return editor.registerCommand<KeyboardEvent>(
			KEY_TAB_COMMAND,
			(event) => {
				event.preventDefault();
				editor.dispatchCommand(
					event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
					undefined,
				);
				return true;
			},
			COMMAND_PRIORITY_EDITOR,
		);
	},
});
