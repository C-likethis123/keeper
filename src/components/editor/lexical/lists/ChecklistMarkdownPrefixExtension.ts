import { defineExtension } from "lexical";

import { registerChecklistMarkdownPrefixTransform } from "./checklistMarkdownPrefix";

export const ChecklistMarkdownPrefixExtension = defineExtension({
  name: "keeper/ChecklistMarkdownPrefix",
  register(editor) {
    return registerChecklistMarkdownPrefixTransform(editor);
  },
});
