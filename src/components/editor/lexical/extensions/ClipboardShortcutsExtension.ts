import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $parseSerializedNode,
  $selectAll,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  KEY_DOWN_COMMAND,
  defineExtension,
} from "lexical";
import {
  exportLexicalToMarkdown,
  parseMarkdownToSerializedNodes,
} from "../markdown";
import { shouldImportPastedMarkdown } from "./MarkdownPasteExtension";

function isFullEditorSelection(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return false;
  }

  const root = $getRoot();
  const points = selection.getStartEndPoints();
  if (points === null) {
    return false;
  }

  const [start, end] = points;
  if (
    start.key === root.getKey() &&
    start.type === "element" &&
    start.offset === 0 &&
    end.key === root.getKey() &&
    end.type === "element" &&
    end.offset === root.getChildrenSize()
  ) {
    return true;
  }

  const selectedNodeKeys = new Set(
    selection.getNodes().map((node) => node.getKey()),
  );
  const rootChildren = root.getChildren();
  return (
    rootChildren.length > 0 &&
    rootChildren.every((node) => selectedNodeKeys.has(node.getKey()))
  );
}

function getClipboardText(): string | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return null;
  }

  return isFullEditorSelection()
    ? exportLexicalToMarkdown()
    : selection.getTextContent();
}

function writeClipboardText(text: string): void {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return;
  }

  void clipboard.writeText(text).catch(() => undefined);
}

function insertClipboardText(text: string): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || text.length === 0) {
    return;
  }

  if (shouldImportPastedMarkdown(text)) {
    const serializedNodes = parseMarkdownToSerializedNodes(text);
    if (serializedNodes.length > 0) {
      $insertNodes(serializedNodes.map((node) => $parseSerializedNode(node)));
      return;
    }
  }

  selection.insertRawText(text);
}

function isModShortcut(event: KeyboardEvent, key: string): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    event.key.toLowerCase() === key
  );
}

export const ClipboardShortcutsExtension = defineExtension({
  name: "keeper/ClipboardShortcuts",
  register(editor) {
    const unregisterCopyCommand = editor.registerCommand(
      COPY_COMMAND,
      (event: ClipboardEvent) => {
        const text = getClipboardText();
        if (text === null || event.clipboardData === null) {
          return false;
        }

        event.preventDefault();
        event.clipboardData.setData("text/plain", text);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    const unregisterKeyDownCommand = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (isModShortcut(event, "a")) {
          event.preventDefault();
          $selectAll();
          return true;
        }

        if (isModShortcut(event, "c")) {
          const text = getClipboardText();
          if (text === null) {
            return false;
          }
          writeClipboardText(text);
          return false;
        }

        if (isModShortcut(event, "v")) {
          const clipboard = globalThis.navigator?.clipboard;
          if (!clipboard?.readText) {
            return false;
          }
          event.preventDefault();
          void clipboard
            .readText()
            .then((text) => {
              editor.update(
                () => {
                  insertClipboardText(text);
                },
                { discrete: true, tag: "paste" },
              );
            })
            .catch(() => undefined);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      unregisterCopyCommand();
      unregisterKeyDownCommand();
    };
  },
});
