import { defineExtension } from "lexical";

import { registerTodoTriggerTransform } from "../plugins/todoTriggerTransform";

export const TodoTriggerExtension = defineExtension({
	name: "keeper/TodoTrigger",
	register(editor) {
		return registerTodoTriggerTransform(editor);
	},
});
