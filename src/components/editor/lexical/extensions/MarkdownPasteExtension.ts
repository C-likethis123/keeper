import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $parseSerializedNode,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  defineExtension,
} from "lexical";
import { parseMarkdownToSerializedNodes } from "../markdown";

const MARKDOWN_BLOCK_PATTERN =
  /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~|\|.+\||!\[[^\]]*\]\(|\[[^\]]+\]\([^)]+\)|\$\$|:::)/;
const MARKDOWN_INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\[\[[^\]\n]+\]\]|\$[^$\n]+\$)/;

function getPlainTextFromPasteEvent(event: Event): string {
  if ("clipboardData" in event) {
    const clipboardData = event.clipboardData as DataTransfer | null;
    return clipboardData?.getData("text/plain") ?? "";
  }
  return "";
}

function shouldImportPastedMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return (
    MARKDOWN_BLOCK_PATTERN.test(trimmed) || MARKDOWN_INLINE_PATTERN.test(trimmed)
  );
}

export const MarkdownPasteExtension = defineExtension({
  name: "keeper/MarkdownPaste",
  register(editor) {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const markdown = getPlainTextFromPasteEvent(event);
        if (!shouldImportPastedMarkdown(markdown)) {
          return false;
        }

        const serializedNodes = parseMarkdownToSerializedNodes(markdown);
        if (serializedNodes.length === 0) {
          return false;
        }

        event.preventDefault();
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }
            $insertNodes(
              serializedNodes.map((node) => $parseSerializedNode(node)),
            );
          },
          { discrete: true, tag: "paste" },
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  },
});
