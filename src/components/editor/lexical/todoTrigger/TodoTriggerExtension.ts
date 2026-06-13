import { defineExtension } from "lexical";

import { registerTodoTriggerTransform } from "./todoTriggerTransform";

export const TodoTriggerExtension = defineExtension({
  name: "keeper/TodoTrigger",
  register(editor) {
    return registerTodoTriggerTransform(editor);
  },
});
